import math
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
import torchaudio as ta, torchaudio.functional as taF
from types import SimpleNamespace

'''
20210111
0. GreenTF 객체 생성
    컨벌루션 커널 생성 단계, 커널은 정변환 및 역변환 모두에서 사용됨
    sample_rate = 음성파일 sample_rate
    min_freq >= 0, 변환후 역변환까지 해야 하는 경우 0으로 설정 권장(0 이상일 경우 missing frequency 에 따른 distortion 증가)
    max_freq <= sample_rate // 2,  역변환을 위해서는 최대값으로 설정 권장(동일 이유)
    f_stride: 출력되는 frequency 의 stride, 예)f_stride=2 -> (0, 2, 4 .... 8000Hz) 출력
    decay_mode: uniform or proportional*
    halflife: uniform mode 에서의 반감기, proportional mode 에서 무시됨
    halflife_in_periods: proportional mode 에서 주기의 배수로서의 반감기(halflife_in_periods=10, f=100Hz -> 반감기=0.01*10)
    kernel_size: 컨볼루션 커널 사이즈 (반감기의 10배이상이면 충분, 5배정도에서도 오차 크지 않음, kernel_size 는 계산 시간 및 메모리 사용량에 비례  
    
1. 정변환
    forward 함수 사용(내부에서 transform 함수 호출)
    numpy or torch tensor 사용 가능, batch or non-batch shape 모두 입력 가능하며 같은 형태로 출력함
    stride: 출력 stride, 1ms 간격으로 출력하려면 stride = sample_rate // 1000
    power: None(output 옵션에 따라 sine, cosine 또는 x, v 성분으로 출력, Green_TF.pdf(DJ Transform using Green function and Inverse Transform 참고)
           1(스펙트럼 amplitude) or 2(스펙트럼 제곱) -> 이 옵션 사용시 역변환 불가
    normalize: input wav 가 pure sinusoidal 함수로 주어졌을때(순음, 그 조하블) 스펙트럼의 amplitude 와 input wav 의 amplitude 가 최대한 일치하도록 규격화 함
    
2. 역변환 
    inverse 함수 사용(내부에서 inv_transform 함수 호출)
    numpy or torch tensor 사용 가능, batch or non-batch shape 모두 입력 가능하며 같은 형태로 출력함
    stride: 정변환시 stride 그대로 입력
    normalized: 정변환시 normalize 값 그대로 입력
    length: 역변환 후 생성되는 wav 길이, 실제 생성 가능 한 길이보다 큰 값 입력시 zero padding 됨. 작은 값 입력시에는 trim
            (일반적인 istft 에서 length 문제와 같음, 참조 https://pytorch.org/docs/stable/generated/torch.istft.html)    
    hopping, num_overlap: Green_TF.pdf 참고, hopping>=1, num_overlap>=1 역변환의 시간 및 오차에 영향을 줄 수 있음
    
3. sc2xy, xy2sc 함수 
   Green_TF.pdf 참조
   DJT 의 x,v 표현과 sine, cosine 표현 사이의 변환
   특별히 쓸 일은 없을 것으로 예상됨. 

220517
1. streaming 기능 추가
'''

def _get_kernel_size(config):
    '''
    전달된 config 값에 따라 kernel_size를 계산해서 리턴한다.
    
    Parameters:
        config: kernel_size를 계산하기 위한 grtf config
    Returns:
        kernel_size: config에 따라 계산된 kernel_size
    '''
    num_of_samples_in_half_life = int(config.sample_rate * config.hl)
    kernel_size = 1
    while kernel_size < num_of_samples_in_half_life * config.km:
        kernel_size *=  2
    return kernel_size

class GreenTFConfig(SimpleNamespace):
    def __init__(self, low=0, high=8000, fr_stride=1, hl=0.02, km=5, spt=1, normalize=True, channel=1, sr=16000, hp=1, no=8, as_=0, t_stride=1):

        super().__init__(low=low, high=high, fr_stride=fr_stride, hl=hl, km=km, spt=spt, 
                    normalize=normalize, channel=channel, sample_rate=sr, hp=hp, no=no, as_=as_, t_stride=t_stride, dtype=torch.float32)

        self.dtype = torch.float32
        self.num_freqs = (high-low+1)//fr_stride
        self.hlmsec = int(hl * 1000) # half_life in msec
        self.normalized = normalize
        self.stride = t_stride * sr // 1000
        self.kernel_size = _get_kernel_size(self)

        self.halflife_in_periods = 50.0
        self.decay_mode = 'uniform'

    def recalc_kernel_size(self):
        self.kernel_size = _get_kernel_size(self)

class GreenTF(nn.Module):

    def __init__(self, is_streaming, config=None):
        super().__init__()

        if config == None:
            self.config = GreenTFConfig()
        else:
            self.config = config
        
        # warning for config
        if config.sr < 2 * config.high:
            print(f"GRTF Warning: sample rate{config.sr} must be larger than or equal to two times of highest frequency(2*{config.high})")
        
        # if config.sr % 1000 != 0:
        #     print(f"GRTF Warning: sample rate{config.sr} must be divisable by 1000")
        
        self.make_kernel()
        self.eval()

        self.is_streaming = is_streaming
        if self.is_streaming:
            self._prev_tail = None

    def set_config(self, low=None, high=None, fr_stride=None, hl=None, km=None, spt=None, 
        normalize=None, channel=None, sr=None, hp=None, no=None, as_=None, t_stride=None, length=None):

        if low != None:
            self.config.low = low
        
        if high != None:
            self.config.high=high
        
        if high != None:
            self.config.fr_stride=fr_stride
        
        if high != None:
            self.config.hl=hl
        
        if high != None:
            self.config.km=km
        
        if high != None:
            self.config.spt=spt
        
        if high != None:
            self.config.normalize=normalize
        
        if high != None:
            self.config.channel=channel
        
        if high != None:
            self.config.sr=sr
        
        if high != None:
            self.config.hp=hp
        
        if high != None:
            self.config.no=no
        
        if high != None:
            self.config.as_=as_
        
        if high != None:
            self.config.t_stride=t_stride
        
        if length != None:
            self.config.length = length

    def get_config(self):
        return self.config


    @torch.no_grad()    
    def forward(self, wav):
        if len(wav.shape) == 1:
            _batched = False
            wav = wav.unsqueeze(dim=0)
        else:
            _batched = True # for stereo wav source
            
        sspec, cspec = self.transform(wav)
        if self.config.normalize:
                sspec = sspec * math.sqrt(8) / self.envelope_area
                cspec = cspec * math.sqrt(8) / self.envelope_area    

        if not _batched:
            sspec = sspec[0]
            cspec = cspec[0]

        return sspec, cspec

    @torch.no_grad()
    def inverse(self, sspec, cspec, length=None):

        #sspec = sspec.to(self.time.device)
        #cspec = cspec.to(self.time.device)
        if len(sspec.shape) == 2:
            _batched = False
            sspec = sspec.unsqueeze(dim=0)
            cspec = cspec.unsqueeze(dim=0)
        else:
            _batched = True
        
        if self.config.normalized:
            sspec = sspec / math.sqrt(8) * self.envelope_area
            cspec = cspec / math.sqrt(8) * self.envelope_area

        wav = self.inv_transform(sspec, cspec)
        _length = wav.shape[-1]
        length = length or _length
        if length > _length:
            wav = F.pad(wav, (0, length-_length))
        elif length < _length:
            wav = wav[...,:length]

        if _batched:
            return wav
        else:
            return wav[0]

    @torch.no_grad()
    def transform(self, wav):
        if self.config.decay_mode == 'uniform' or self.config.decay_mode == 'fourier':
            kernel = (self.kernel * self.envelope / self.config.sample_rate).unsqueeze(dim=1)
            if self.is_streaming:
                if self._prev_tail == None:
                    wav = F.pad(wav, (self.kernel_size - 1, 0)).unsqueeze(dim=1)
                else:
                    wav = torch.cat((self._prev_tail, wav), dim=1).unsqueeze(dim=1)
            else:
                wav = F.pad(wav, (self.config.kernel_size - 1, 0)).unsqueeze(dim=1)
            spec = F.conv1d(wav, kernel, stride=self.config.stride)
            sspec, cspec = torch.chunk(spec, 2, dim=1)
        elif self.decay_mode == 'proportional':
            envelope_low = self.envelope[:self.fmid,-self.low_kernel_size:].unsqueeze(dim=1)
            envelope_high = self.envelope[self.fmid:,-self.high_kernel_size:].unsqueeze(dim=1)
            envelope_low = envelope_low.repeat(2, 1, 1)
            envelope_high = envelope_high.repeat(2, 1, 1)
            low_kernel = self.low_kernel.unsqueeze(dim=1) * envelope_low / self.sample_rate
            high_kernel = self.high_kernel.unsqueeze(dim=1) * envelope_high / self.sample_rate
            low_wav = F.pad(wav, (self.low_kernel_size - 1, 0)).unsqueeze(dim=1)
            low_spec = F.conv1d(low_wav, low_kernel, stride=self.config.stride)
            low_sspec, low_cspec = torch.chunk(low_spec, 2, dim=1)
            high_wav = F.pad(wav, (self.high_kernel_size - 1, 0)).unsqueeze(dim=1)
            high_spec = F.conv1d(high_wav, high_kernel, stride=self.config.stride)
            high_sspec, high_cspec = torch.chunk(high_spec, 2, dim=1)
            sspec = torch.cat([low_sspec, high_sspec], dim=1)
            cspec = torch.cat([low_cspec, high_cspec], dim=1)            
        return sspec, cspec

    @torch.no_grad()
    def inv_transform(self, sspec, cspec):
        bsize, fsize, tsize = sspec.shape
        dtype = self.config.dtype
        stride = self.config.stride
        hopping = self.config.hp
        num_overlap = self.config.no
        _stride = stride * hopping
        _length = 1 + (tsize - 1) * stride
        _kernel_size = min(self.config.kernel_size, num_overlap * _stride)
        if hopping > 1:
            start = (tsize - 1) % hopping
            sspec = sspec[...,start::hopping]
            cspec = cspec[...,start::hopping]
            
        if self.config.decay_mode == 'fourier':
            win = self.envelope2[...,-_kernel_size:]
            envelope = self.envelope[...,-_kernel_size:]
            skernel = self.kernel[:fsize,-_kernel_size:] * envelope * self.f_stride * 2
            ckernel = self.kernel[fsize:,-_kernel_size:] * envelope * self.f_stride * 2
            if self.min_freq == 0:
                skernel[0] *= 0.5
                ckernel[0] *= 0.5
            fspec = torch.einsum('bft,fi->bit', sspec, skernel) + torch.einsum('bft,fi->bit', cspec, ckernel)
        elif self.config.decay_mode == 'proportional':
            fmid = self.fmid
            _fsize_low = self.fmid
            _fsize_high = fsize - self.fmid  
            delta = self.beta * 2 * math.pi * self.max_freq
            _kernel_size = min(_kernel_size, self.high_kernel_size)
            win = torch.exp(-delta * self.time[...,-_kernel_size:])
            envelope_low = win / self.envelope[:fmid,-_kernel_size:]
            envelope_high = win / self.envelope[fmid:,-_kernel_size:]
            low_skernel = self.low_kernel[:_fsize_low,-_kernel_size:] * envelope_low * self.f_stride * 2
            low_ckernel = self.low_kernel[_fsize_low:,-_kernel_size:] * envelope_low * self.f_stride * 2
            high_skernel = self.high_kernel[:_fsize_high,-_kernel_size:] * envelope_high * self.f_stride * 2
            high_ckernel = self.high_kernel[_fsize_high:,-_kernel_size:] * envelope_high * self.f_stride * 2
            if self.min_freq == 0:
                low_skernel[0] *= 0.5
                low_ckernel[0] *= 0.5
                high_skernel[0] *= 0.5
                high_ckernel[0] *= 0.5
            fspec_low = self.gamma * (torch.einsum('bft,fi->bit', sspec[:,:fmid,:], low_skernel) + \
                                      torch.einsum('bft,fi->bit', cspec[:,:fmid,:], low_ckernel))
            fspec_low += self.beta * (torch.einsum('bft,fi->bit', cspec[:,:fmid,:], low_skernel) - \
                                      torch.einsum('bft,fi->bit', sspec[:,:fmid,:], low_ckernel))   
            fspec_high = self.gamma * (torch.einsum('bft,fi->bit', sspec[:,fmid:,:], high_skernel) + \
                                       torch.einsum('bft,fi->bit', cspec[:,fmid:,:], high_ckernel))
            fspec_high += self.beta * (torch.einsum('bft,fi->bit', cspec[:,fmid:,:], high_skernel) - \
                                       torch.einsum('bft,fi->bit', sspec[:,fmid:,:], high_ckernel)) 
            fspec = (fspec_low + fspec_high)        
        elif self.config.decay_mode == 'uniform':
            win = self.envelope2[...,-_kernel_size:]
            envelope = self.envelope[...,-_kernel_size:]
            if self.idx_start_osc is None:
                raise Exception('No oscillating kernel. Inverse DJT requires the oscillating part of the kernel.')
            if self.idx_start_osc == 0:
                _start = self.idx_start_osc
                dalpha = self.alpha[_start:] - F.pad(self.alpha[_start:-1], (0, 0, 1, 0))
            else:
                _start = self.idx_start_osc - 1
                dalpha = F.pad(self.alpha[_start+1:] - self.alpha[_start:-1], (0, 0, 0, 1), value=2*math.pi*self.config.fr_stride)
            skernel = self.kernel[_start:fsize,-_kernel_size:] * envelope * 2
            ckernel = self.kernel[fsize+_start:,-_kernel_size:] * envelope * 2
            skernel *= dalpha / (2 * math.pi)
            ckernel *= dalpha / (2 * math.pi)
            fspec = torch.einsum('bft,fi->bit', sspec[:,_start:,:], skernel) + torch.einsum('bft,fi->bit', cspec[:,_start:,:], ckernel)

        # overlap-add or Griffin-Lim    
        win2 = win.reshape(-1, 1)
        _kpad = (_stride - (_kernel_size % _stride)) % _stride
        _ksize = _kernel_size + _kpad
        n_pick = _ksize // _stride
        _tpad = n_pick - 1
        _tsize = fspec.shape[-1]

        pick = torch.zeros([_stride, _ksize, n_pick], dtype=dtype)        
        for i in range(_stride):
            for j in range(n_pick):
                pick[i, _ksize - j * _stride - (_stride - i), j] = 1.0
        pick = pick.to(sspec.device)
        win2 = F.pad(win2.expand(-1, _tsize), (0, _tpad, _kpad, 0))
        fspec = F.pad(fspec, (0, _tpad, _kpad, 0))
        
        win_sum = F.conv1d(win2.unsqueeze(0), pick).permute(0, 2, 1).reshape(1, -1)
        wav = F.conv1d(fspec, pick).permute(0, 2, 1).reshape(bsize, -1)
        wav = wav / win_sum
        if not self.is_streaming:
            wav = wav[...,-_length:]
        return wav
        
    @torch.no_grad()    
    def make_kernel(self):
        kernel_size = self.config.kernel_size
        min_freq = self.config.low
        max_freq = self.config.high
        f_stride = self.config.fr_stride
        n_freq = self.config.num_freqs
        sample_rate = self.config.sr
        decay_mode = self.config.decay_mode
        halflife = self.config.hl
        halflife_in_periods = self.config.halflife_in_periods
        dtype = self.config.dtype
        
        time = torch.linspace((kernel_size-1)/sample_rate, 0, kernel_size, dtype=dtype).unsqueeze(dim=0) 
        frequency = torch.linspace(min_freq, max_freq, n_freq, dtype=dtype).unsqueeze(dim=-1)
        omega = 2 * math.pi * frequency
        omega2 = omega ** 2
        omega_clipped = torch.clamp(omega, min=0.1) # for the inverse of omega not to diverge
        omega_time = omega * time
        
        if decay_mode == 'fourier':
            beta = torch.tensor(math.log(2) / halflife, dtype=dtype)
            beta2 = beta ** 2
            envelope = torch.exp(-beta * time)
            envelope[...,-1] *= 0.5 # effectively Riemann sum -> Trapzoidal sum 
            skernel = torch.sin(omega_time) # 0 if f == 0
            ckernel = torch.cos(omega_time) # 1 if f == 0            
            sckernel = torch.cat([skernel, ckernel], dim=0)
            self.kernel = nn.Parameter(sckernel, requires_grad=False)
                    
        elif decay_mode == 'proportional':
            beta2pi = torch.tensor(math.log(2) / halflife_in_periods, dtype=dtype)
            beta = beta2pi / 2 / math.pi
            beta2 = beta ** 2
            self.gamma = gamma = math.sqrt(1 - beta2)
            print('halflife is proportional to periods by a factor of ', halflife_in_periods, 'beta:', beta, 'gamma:', gamma)            
            envelope = torch.exp(-beta * omega_time)
            envelope[...,-1] *= 0.5
            skernel = torch.sin(gamma * omega_time)
            ckernel = torch.cos(gamma * omega_time)
            self.fmid = fmid = 1024 // f_stride
            self.low_kernel_size = low_kernel_size = kernel_size
            self.high_kernel_size = high_kernel_size = kernel_size
            low_skernel = skernel[:fmid]
            low_ckernel = ckernel[:fmid]
            high_skernel = skernel[fmid:,-high_kernel_size:]
            high_ckernel = ckernel[fmid:,-high_kernel_size:]
            low_sckernel = torch.cat([low_skernel, low_ckernel], dim=0)
            high_sckernel = torch.cat([high_skernel, high_ckernel], dim=0)
            self.low_kernel = nn.Parameter(low_sckernel, requires_grad=False)
            self.high_kernel = nn.Parameter(high_sckernel, requires_grad=False)
            gamma_omega = gamma * omega
        
        elif decay_mode == 'uniform':
            beta = torch.tensor(math.log(2) / halflife, dtype=dtype)
            beta2 = beta ** 2
            beta2_omega2 = beta2 - omega2
            alpha = torch.sqrt(torch.abs(beta2_omega2))        
            alpha_clipped = torch.clamp(alpha, min=0.01)
            alpha_time = alpha * time
            envelope = torch.exp(-beta * time)
            envelope[...,-1] *= 0.5
                                  
            idx_start_osc = None
            idx_critical = None
            idx_end_exp = None
            for i, f in enumerate(range(min_freq, max_freq + 1, f_stride)):
                if beta2_omega2[i,0] < 0:
                    idx_start_osc = i
                    break
            if idx_start_osc > 0:
                if beta2_omega2[idx_start_osc-1,0] == 0:
                    idx_critical = idx_start_osc - 1
                    if idx_critical > 0:
                        idx_end_exp = idx_critical
                else:
                    idx_end_exp = idx_start_osc
                  
            skernel = torch.zeros_like(alpha_time)
            ckernel = torch.zeros_like(alpha_time)             
            if idx_end_exp is not None:
                _alpha = alpha[:idx_end_exp]
                _alpha_time = alpha_time[:idx_end_exp]
                skernel[:idx_end_exp] = torch.sinh(_alpha_time) 
                ckernel[:idx_end_exp] = torch.cosh(_alpha_time)                            
            if idx_critical is not None:
                skernel[idx_critical] = 0.0
                ckernel[idx_critical] = 1.0
            if idx_start_osc is not None:            
                _alpha = alpha[idx_start_osc:]
                _alpha_time = alpha_time[idx_start_osc:]
                skernel[idx_start_osc:] = torch.sin(_alpha_time)
                ckernel[idx_start_osc:] = torch.cos(_alpha_time)
            sckernel = torch.cat([skernel, ckernel], dim=0)
            self.kernel = nn.Parameter(sckernel, requires_grad=False)
            
            self.idx_start_osc = idx_start_osc
            self.idx_critical = idx_critical
            self.idx_end_exp = idx_end_exp
            self.alpha = nn.Parameter(alpha, requires_grad=False)
            self.alpha_clipped = nn.Parameter(alpha_clipped, requires_grad=False)
        
        self.beta = nn.Parameter(beta, requires_grad=False)
        self.frequency = nn.Parameter(frequency, requires_grad=False)
        self.time = nn.Parameter(time, requires_grad=False)
        self.omega = nn.Parameter(omega, requires_grad=False)
        self.omega_clipped = nn.Parameter(omega_clipped, requires_grad=False)
        self.omega2 = nn.Parameter(omega2, requires_grad=False)
        self.omega_time = nn.Parameter(omega_time, requires_grad=False)
        self.envelope = nn.Parameter(envelope, requires_grad=False)
        self.envelope_area = nn.Parameter(envelope.sum(dim=-1, keepdim=True) / sample_rate, requires_grad=False)
        self.envelope2 = nn.Parameter(envelope**2, requires_grad=False)

    def setPrevTail(self, prev_tail):
        if self._prev_tail != None:
            assert(self._prev_tail.shape == prev_tail.shape)

        self._prev_tail = prev_tail
