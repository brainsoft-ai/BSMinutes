import torch, torchaudio
from .grtf import GreenTF, GreenTFConfig
from types import SimpleNamespace
from .djs import DJS

def _get_specs(sin_spec, cos_spec, channels):
    if sin_spec.device.type == 'cpu':
        sin_spec = sin_spec.to('cuda')
    if cos_spec.device.type == 'cpu':
        cos_spec = cos_spec.to('cuda')

    # if mono sound, 
    if channels == 1:
        sin_specs = [sin_spec]
        cos_specs = [cos_spec]
    # if stereo sound
    elif channels == 2:
        assert sin_spec.shape[0] == 2
        sin_specs = [torch.unsqueeze(sin_spec[0], 0)]
        sin_specs.append(torch.unsqueeze(sin_spec[1], 0))
        cos_specs = [torch.unsqueeze(cos_spec[0], 0)]
        cos_specs.append(torch.unsqueeze(cos_spec[1], 0))
    return sin_specs, cos_specs

class DJT():
    '''
    agent for DJ transformation
    '''
    def __init__(self, is_streaming=False, sample_rate=16000, channels=2, device='cuda'):

        self._prev_tail = None
        self._chunk_size = 0 # what was this for?

        # i'm not sure if this is a correct way to use SimpleNamespace...reconsider this part later
        config = GreenTFConfig()
        config.channel = channels
        config.sr = sample_rate
        config.recalc_kernel_size() #sample rate changed
        self._djt_config = config

        greenTF = GreenTF(is_streaming=is_streaming, config=self._djt_config)
        self._djt_config = greenTF.get_config()
        self._greenTF = greenTF.to(device)

    def wavpath2djs(self, wav_path):
        wav_data, sr = torchaudio.load(wav_path)
        self._djt_config.channel = wav_data.shape[0]
        self._djt_config.sample_rate = sr
        self._djt_config.recalc_kernel_size() #sample rate changed

        wav_data = wav_data.T.to('cuda')
        return self.wav2djs(wav_data)

    def wav2djs(self, wav_data):

        samples_raw = wav_data

        if samples_raw.dtype != torch.float32:
            print('invalid sample type:', samples_raw.dtype)
            raise ValueError

        if self._djt_config.channel == 1:
            samples_mono = samples_raw

            if self._greenTF.is_streaming and self._prev_tail != None:
                self._greenTF.setPrevTail(self._prev_tail)

            sspec, cspec = self._greenTF.forward(samples_mono)

            sspec = torch.unsqueeze(sspec, dim=0)
            cspec = torch.unsqueeze(cspec, dim=0)
            self._djt_config.length = len(sspec[0, 0])
            spectrogram = DJS(sin_spec=sspec, cos_spec=cspec, config=self._djt_config)

        elif self._djt_config.channel == 2:
            samples_stereo = samples_raw

            if self._greenTF.is_streaming and self._prev_tail != None:
                self._greenTF.setPrevTail(self._prev_tail.transpose(1, 0))

            sspec, cspec = self._greenTF.forward(samples_stereo.transpose(1, 0))
            self._djt_config.length = len(sspec[0, 0])

            spectrogram = DJS(sin_spec=sspec, cos_spec=cspec, config=self._djt_config)
        else:
            print('wrong number of channel : ', self._djt_config.channel)
            raise ValueError

        self._djt_config.length = spectrogram.get_time_length()

        self._prev_tail = wav_data[-self._djt_config.kernel_size+1:, ...]

        return spectrogram

    def djs2wav(self, djs, save=False, wav_path=None):
        sspec, cspec, _, _ = djs.getSpectrograms()

        stride = self._djt_config.stride
        sin_specs, cos_specs = _get_specs(sspec, cspec, self._djt_config.channel)

        # revamp the following: need to do batch process for stereo data
        wavs = []
        for i, sin_spec in enumerate(sin_specs):
            cos_spec = cos_specs[i]
            wav = self._greenTF.inverse(sin_spec, cos_spec)
            wavs.append(wav.squeeze())

        #wav = self._greenTF.inverse(sspec, cspec)

        samples_float32 = torch.stack(wavs, dim=1)
        abs_max = torch.abs(samples_float32).max()
        if abs_max > 1.:
            samples_float32 = samples_float32 / abs_max

        if save:
            if wav_path == None:
                raise ValueError("File path must be provided to save audio")
            
            torchaudio.save(wav_path, samples_float32.T.cpu(), self._djt_config.sample_rate)
            pass

        return samples_float32