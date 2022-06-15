# from glob import glob
import struct
from os.path import isdir, isfile, join as p_join
import numpy as np
# from matplotlib import pyplot as plt

import torch, torchaudio

from .grtf import GreenTF, GreenTFConfig

class DJSError(Exception):
    pass

class DJS():
    '''
    - DJS data container and data utility class
    - contained data is immutable
    - DJS file format(header and body data)
        HEADER: 32 byte(= int x 8) [need to rename element names?]
            numOfChannels(int), lowestFreq(int), highestFreq(int), numOfSpectrums(int), 
            reserved(int), samplingRate(int), spectrogramType(int), halfLifeMsec(int)
        BODY: [sin_spec, cos_spec] 
            sin_spec/cos_spec = [ch, (highestFreq - lowestFreq + 1)/fr_stride, numOfSpectrums]
    
    - save/load: tensor transpose must be revamped
    '''
    def __init__(self, *, file_path=None, sin_spec=None, cos_spec=None, config=None):

        try:
            self.load(file_path)
        except:
            if sin_spec != None and cos_spec != None and config != None: 
                self._sin_spec = sin_spec
                self._cos_spec = cos_spec
                self._amp_spec = None
                self._pha_spec = None
                self._config = config
            else:
                raise DJSError("DJS Error: A proper djs file path or proper sin/cos spectrogram data must be provided")

    def load(self, djs_path):
        try:
            with open(djs_path, "rb") as f:
                header = f.read(32)
                numOfChannels, lowestFreq, highestFreq, numOfSpectrums = struct.unpack('iiii', header[:16])
                samplingRate, spectrogramType, halfLifeMsec = struct.unpack('iii', header[20:])
                spectrogram = np.fromfile(f, dtype=np.float32)

            if numOfChannels == 1:
                spectrogram = np.reshape(spectrogram, (2, 1, (highestFreq - lowestFreq + 1), numOfSpectrums))
                numOfFreqs = len(spectrogram[0, 0])
                spectrogram = torch.from_numpy(spectrogram)
            elif numOfChannels == 2:
                spectrogram = np.reshape(spectrogram, (2, (highestFreq - lowestFreq + 1), numOfSpectrums, 2))
                spectrogram = np.transpose(spectrogram, (0, 3, 1, 2))
                # spectrogramLeft = np.reshape(spectrogram[0], ((highestFreq - lowestFreq + 1), numOfSpectrums))
                # spectrogramRight = np.reshape(spectrogram[1], ((highestFreq - lowestFreq + 1), numOfSpectrums))
                # spectrogram = np.array([spectrogramLeft, spectrogramRight])
                numOfFreqs = len(spectrogram[0, 0])
                spectrogram = torch.from_numpy(spectrogram)
            else:
                print(f'Invalid Number of Channel:{numOfChannels}')
                raise ValueError

            self._sin_spec = spectrogram[0]
            self._cos_spec = spectrogram[1]
            self._amp_spec = None
            self._pha_spec = None

            config = GreenTFConfig(
                low     = lowestFreq, 
                high    = highestFreq,
                hl      = halfLifeMsec/1000,
                spt     = spectrogramType,
                channel = numOfChannels, 
                sr      = samplingRate
            )
            config.length = numOfSpectrums
            config.num_freq = numOfFreqs
            self._config = config

        except IOError as e:
            raise ValueError("Couldn't open file (%s.)" % e)

    def save(self, djs_path):

        if djs_path[-4:].lower() != ".djs":
            djs_path = djs_path + ".djs"

        if isfile(djs_path):
            raise DJSError(f"file already exists: {djs_path}")

        numOfChannels   = self._config.channel
        lowestFreq      = self._config.low
        highestFreq     = self._config.high
        numOfSpectrums  = self._config.length
        samplingRate    = self._config.sr
        spectrogramType = self._config.spt
        halfLifeMsec    = self._config.hlmsec

        sspec = self._sin_spec.cpu().detach().numpy()
        cspec = self._cos_spec.cpu().detach().numpy()
        if numOfChannels == 2:
            sspec = sspec.reshape(2, -1).T
            cspec = cspec.reshape(2, -1).T

        spectrogram = np.array([sspec, cspec])
        data = spectrogram.flatten()
        with open(djs_path, "wb") as f:
            f.write(struct.pack('i', numOfChannels))
            f.write(struct.pack('i', lowestFreq))
            f.write(struct.pack('i', highestFreq))
            f.write(struct.pack('i', numOfSpectrums))
            f.write(struct.pack('i', 0))
            f.write(struct.pack('i', samplingRate))
            f.write(struct.pack('i', spectrogramType))
            f.write(struct.pack('i', halfLifeMsec))
            f.write(data.tobytes())

    def cpu():
        if self._sin_spec != None:
            self._sin_spec.cpu()
        if self._cos_spec != None:
            self._cos_spec.cpu()
        if self._amp_spec != None:
            self._amp_spec.cpu()
        if self._pha_spec != None:
            self._pha_spec.cpu()

    def cuda():
        if self._sin_spec != None:
            self._sin_spec.cuda()
        if self._cos_spec != None:
            self._cos_spec.cuda()
        if self._amp_spec != None:
            self._amp_spec.cuda()
        if self._pha_spec != None:
            self._pha_spec.cuda() 

    # for various DJS drawing purposes in the future
    def draw(self):
        start_time = 0
        if end_freq is None:
            end_freq, end_time = spectrogram.shape
        else:
            _, end_time = spectrogram.shape
        start_freq = start_freq 
        end_freq = end_freq
        fig = plt.figure(figsize=(12, 10.8))
        ax1 = fig.add_subplot(111)
        extent = [start_time, end_time, start_freq, end_freq]
        plt.imshow(spectrogram, extent=extent, aspect='auto', origin='lower')
        plt.axis([start_time, end_time, start_freq, end_freq])
        ax1.set_aspect(aspect=(end_time - start_time + 1) / (end_freq - start_freq + 1))
        ax1.xaxis.set_tick_params(labelsize=25)
        ax1.yaxis.set_tick_params(labelsize=25)
        plt.xlabel('Time (msec)', fontsize=25)
        plt.ylabel('Frequency (Hz)', fontsize=25)
        #plt.title(title_text)
        plt.colorbar()
        #plt.show()
        plt.savefig(png_path)

    def get_config(self):
        return self._config

    def get_sin_spectrogram(self, fslice=slice(None, None), tslice=slice(None, None)):
        spec = self._sin_spec[..., fslice, tslice].clone().detach()
        return spec

    def get_cos_spectrogram(self, fslice=slice(None, None), tslice=slice(None, None)):
        spec = self._cos_spec[..., fslice, tslice].clone().detach()
        return spec

    def get_amplitude_spectrogram(self, fslice=slice(None, None), tslice=slice(None, None)):
        if self._sin_spec == None or self._cos_spec == None:
            return None
        
        if self._amp_spec == None:
            self._amp_spec = torch.sqrt(torch.square(self._sin_spec) + torch.square(self._cos_spec))
        spec = self._amp_spec[..., fslice, tslice].clone().detach()
        return spec

    def get_phase_spectrogram(self, fslice=slice(None, None), tslice=slice(None, None)):
        if self._sin_spec == None or self._cos_spec == None:
            return None
        
        if self._pha_spec == None:
            self._pha_spec = torch.sqrt(torch.square(self._sin_spec) + torch.square(self._cos_spec))
        spec = self._pha_spec[..., fslice, tslice].clone().detach()
        return spec

    def getSpectrograms(self):
        return self.get_sin_spectrogram(), self.get_cos_spectrogram(), self.get_amplitude_spectrogram(), self.get_phase_spectrogram()

    def get_time_length(self):
        return self._config.length

    def get_freq_length(self):
        return self._config.num_freqs

def loadDJS(djs_path):
    djs = DJS(file_path=djs_path)
    return djs

def saveDJS(djs_path, sin_spec, cos_spec, configuration):
    djs = DJS(sin_spec=sin_spec, cos_spec=cos_spec, config=configuration)
    djs.save(djs_path)

def drawDJS(png_path, spectrogram, start_freq=0, end_freq=None):
    '''
    this function is not implemented yet
    '''
    start_time = 0
    if end_freq is None:
        end_freq, end_time = spectrogram.shape
    else:
        _, end_time = spectrogram.shape
    start_freq = start_freq 
    end_freq = end_freq
    fig = plt.figure(figsize=(12, 10.8))
    ax1 = fig.add_subplot(111)
    extent = [start_time, end_time, start_freq, end_freq]
    plt.imshow(spectrogram, extent=extent, aspect='auto', origin='lower')
    plt.axis([start_time, end_time, start_freq, end_freq])
    ax1.set_aspect(aspect=(end_time - start_time + 1) / (end_freq - start_freq + 1))
    ax1.xaxis.set_tick_params(labelsize=25)
    ax1.yaxis.set_tick_params(labelsize=25)
    plt.xlabel('Time (msec)', fontsize=25)
    plt.ylabel('Frequency (Hz)', fontsize=25)
    #plt.title(title_text)
    plt.colorbar()
    #plt.show()
    plt.savefig(png_path)
