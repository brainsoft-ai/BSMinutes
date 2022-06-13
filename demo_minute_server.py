import os
from os.path import isdir
import subprocess
from flask import Flask, flash, request, redirect, url_for, jsonify, render_template, send_file, send_from_directory
from werkzeug.utils import secure_filename
import json, requests
import torch, torchaudio
from torch.nn.functional import pad
import zipfile

from djs.djs import DJS
from djs.djt import DJT

from clovaspeechclient import ClovaSpeechClient

RESULT_FOLDER = './results/'
RESULT_FILE = 'result.zip'
UPLOAD_FOLDER = './downloads/'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'webm'}
uploaded_data = [] #(id, timestamp, filepath)
processed_data = {}
data_semaphore = 0
sessionid = 0
processingid = 0

SAMPLE_RATE = 16000
djt_mix = DJT(sample_rate=SAMPLE_RATE, channels=2)
djt_inv = DJT(sample_rate=SAMPLE_RATE, channels=1)

app = Flask(__name__,
            static_url_path='', 
            static_folder='static',
            template_folder='templates')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULT_FOLDER'] = RESULT_FOLDER


def convert_webm2wav(file_in, file_out):
    command = ['ffmpeg', '-i', file_in, '-c:a', 'pcm_f32le', file_out]
    subprocess.run(command,stdout=subprocess.PIPE,stdin=subprocess.PIPE)



def sync_audio(wav1, time1, wav2, time2, sr):

    if time1 > time2:
        tdiff = time1 - time2
        diff = sr * tdiff // 1000
        new_wav1 = wav1
        new_wav2 = wav2[...,diff:]
    else:
        tdiff = time2 - time1
        diff = sr * tdiff // 1000
        new_wav1 = wav1[...,diff:]
        new_wav2 = wav2

    len1 = new_wav1.shape[1]
    len2 = new_wav2.shape[1]

    if len1 > len2:
        ldiff = len1 - len2
        new_wav2 = pad(new_wav2, (0, ldiff), 'constant', 0.0)
    else:
        ldiff = len2 - len1
        new_wav1 = pad(new_wav1, (0, ldiff), 'constant', 0.0)
    return new_wav1, new_wav2

def mix_mono2stereo(wav_data1, ratio1_l, ratio1_r, wav_data2, ratio2_l, ratio2_r):
    wav_data_l = wav_data1 * ratio1_l + wav_data2 * ratio2_l
    wav_data_r = wav_data1 * ratio1_r + wav_data2 * ratio2_r
    wav_data = torch.concat([wav_data_l, wav_data_r])

    return wav_data

def mix_mono2stereo_file(file1, ratio1_l, ratio1_r, file2, ratio2_l, ratio2_r):
    #wav_data1, sr1 = torchaudio.load(file1)
    wav_data1, sr1 = librosa.load(file1)
    wav_data1 = wav_data1.transpose(0,1).squeeze(1)
    #wav_data2, sr2 = torchaudio.load(file2)
    wav_data2, sr2 = librosa.load(file2)
    wav_data2 = wav_data2.transpose(0,1).squeeze(1)
    assert(sr1==sr2)

    #check mono
    assert(len(wav_data1) == 1)

    wav_data = mix_mono2stereo(wav_data1, ratio1_l, ratio1_r, wav_data2, ratio2_l, ratio2_r)

    return sr1, wav_data

def find_max(spec):
    sin_spec = spec.get_sin_spectrogram()
    cos_spec = spec.get_cos_spectrogram()
    sin_spec_l, sin_spec_r = sin_spec[0], sin_spec[1]
    cos_spec_l, cos_spec_r = cos_spec[0], cos_spec[1]
    amp_l = (sin_spec_l ** 2 + cos_spec_l ** 2) ** 0.5
    amp_r = (sin_spec_r ** 2 + cos_spec_r ** 2) ** 0.5
    
    l_index = (amp_l >= amp_r)
    r_index = (amp_l <= amp_r)

    sin_spec_l, cos_spec_l = sin_spec_l * l_index, cos_spec_l * l_index
    spec_l = DJS(sin_spec = sin_spec_l, cos_spec = cos_spec_l, config = spec.get_config())
    sin_spec_r, cos_spec_r = sin_spec_r * r_index, cos_spec_r * r_index
    spec_r = DJS(sin_spec = sin_spec_r, cos_spec = cos_spec_r, config = spec.get_config())

    return spec_l, spec_r

def naver_transcribe_file(pcm_file, lang):
    if lang == 'ko': lang = 'Kor'
    elif lang == 'en': lang = 'Eng'
    else: raise "wrong"
    # lang =  [Kor, Jpn, Eng, Chn]
    clientID = "yc4p7fth3k"
    clientSecret = "cith95M3hmwkIi3j9Oh2ZCFkPwnxDSJNd5dCDbDi"
    naver_csr_url = url = "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=" + lang
    headers = {
        "X-NCP-APIGW-API-KEY-ID": clientID,
        "X-NCP-APIGW-API-KEY": clientSecret,
        "Content-Type": "application/octet-stream",
    }
    data = open(pcm_file, 'rb')
    response = requests.post(url, data=data, headers=headers)
    rescode = response.status_code
    if(rescode == 200):
        return json.loads(response.text)['text']
    else:
        return "Error : " + response.text

def get_ClovaSpeechSR(file, lang):
    res = ClovaSpeechClient().req_upload(file=file, completion='sync') #diarization test necessary??
    return res

def get_stt(file, lang='ko', stt_engine='naver'):
    if stt_engine.lower() == 'naver':
        #return naver_transcribe_file(file, lang)
        return get_ClovaSpeechSR(file, lang)
    else:
        return "Error"


def get_session_data(sessionid):
    session_dir = f"{RESULT_FOLDER}{sessionid:05d}"
    if not isdir(session_dir):
        return "invalid session id"
    else:
        #remove existing files
        pass

def resample_audio(wav, sr1, sr2):
    downsample_resample = torchaudio.transforms.Resample(
    sr1, sr2, resampling_method='sinc_interpolation')

    wav2 = downsample_resample(wav)
    return wav2, sr2

def get_sessiondir(sessionid):
    return f"{RESULT_FOLDER}{sessionid:05d}/"

def zip_session_content(sessionid):
    session_dir = get_sessiondir(sessionid)
    temp_zip = f"{RESULT_FOLDER}result.zip"
    final_zip = f"{session_dir}result.zip"

    zipf = zipfile.ZipFile(temp_zip, 'w')
    
    for folder, subfolders, files in os.walk(session_dir):
        for file in files:
            print(file)
            zipf.write(os.path.join(folder, file), os.path.relpath(os.path.join(folder,file), session_dir), compress_type = zipfile.ZIP_DEFLATED)
    
    zipf.close()

    os.rename(temp_zip, final_zip)

def clear_download_data():
    uploaded_data.clear()
    files = os.listdir(UPLOAD_FOLDER)
    for file in files:
        print(file)
        os.remove(f"{UPLOAD_FOLDER}{file}")

def process_data(sessionid):
    global processingid
    processingid = sessionid

    session_dir = get_sessiondir(sessionid)
    if not isdir(session_dir):
        os.mkdir(session_dir)
    else:
        #remove existing files
        files = os.listdir(session_dir)
        for file in files:
            path = os.path.join(session_dir, file)
            os.remove(path)

    user1 = uploaded_data[0][0]
    time1 = int(uploaded_data[0][1])
    file1 = uploaded_data[0][2]
    filepath1 = f"{UPLOAD_FOLDER}{file1}"
    file_out1 = f"{user1}_{time1}.wav"
    filepath_out1 = f"{UPLOAD_FOLDER}{file_out1}"
    convert_webm2wav(filepath1, filepath_out1)
    wav1, sr1 = torchaudio.load(filepath_out1)
    wav1, sr1 = resample_audio(wav1, sr1, SAMPLE_RATE)
    ch1 = len(wav1)

    user2 = uploaded_data[1][0]
    time2 = int(uploaded_data[1][1])
    file2 = uploaded_data[1][2]
    filepath2 = f"{UPLOAD_FOLDER}{file2}"
    file_out2 = f"{user2}_{time2}.wav"
    filepath_out2 = f"{UPLOAD_FOLDER}{file_out2}"
    convert_webm2wav(filepath2, filepath_out2)
    wav2, sr2 = torchaudio.load(filepath_out2)
    wav2, sr2 = resample_audio(wav2, sr2, SAMPLE_RATE)
    ch2 = len(wav2)

    assert(sr1 == sr2 and ch1 == ch2)
    sr = sr1
    ch = ch1

    # sync and mix audio files
    wav1, wav2 = sync_audio(wav1, time1, wav2, time2, sr)
    wav = mix_mono2stereo(wav1, 1.0, 0.0, wav2, 0.0, 1.0)
    mix_path = os.path.join(session_dir, "mix.wav")
    torchaudio.save(mix_path, wav, sr)

    # get djs and do find_max
    wav = wav.T.to('cuda')
    #djt_mix = DJT(sample_rate=sr, channels=2) # mix audio channel is always 2
    djs = djt_mix.wav2djs(wav)
    djs1, djs2 = find_max(djs)

    # save processed djs to wav
    #djt_inv = DJT(sample_rate=sr, channels=1)
    file_out1 = f"{user1}.wav"
    new_path1 = f"{session_dir}/{file_out1}"
    wav1 = djt_inv.djs2wav(djs1, save=True, wav_path=new_path1)
    file_out2 = f"{user2}.wav"
    new_path2 = f"{session_dir}/{file_out2}"
    wav2 = djt_inv.djs2wav(djs2, save=True, wav_path=new_path2)

    # get stt and save them
    json_data = {}
    result1 = get_stt(new_path1)
    json_data1 = json.loads(result1.text)
    segment_data = []
    for segment in json_data1['segments']:
        text_data = {}
        text_data['start'] = segment['start']
        text_data['end'] = segment['end']
        text_data['text'] = segment['text']
        segment_data.append(text_data)
    json_data[user1] = segment_data

    result2 = get_stt(new_path2)
    json_data2 = json.loads(result2.text)
    segment_data = []
    for segment in json_data2['segments']:
        text_data = {}
        text_data['start'] = segment['start']
        text_data['end'] = segment['end']
        text_data['text'] = segment['text']
        segment_data.append(text_data)
    json_data[user2] = segment_data

    stt_result_path = f"{session_dir}/stt_result.json"
    with open(stt_result_path, 'w') as outfile:
        json.dump(json_data, outfile, indent=4)

    #zip_session_content(sessionid)

    clear_download_data()
    processingid = 0

@app.route('/')
def index():
    return render_template("index.html")


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/result/<path:path>')
def static_file(path):
    return send_from_directory(app.config['RESULT_FOLDER'], path)

@app.route('/upload', methods=['POST'])
def upload_file():
    if request.method == 'POST':
        body = json.loads(request.form['body'])
        userid = body['id']
        timestamp = body['timestamp']

        # check if the post request has the file part
        if 'audio' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['audio']

        # If the user does not select a file, the browser submits an
        # empty file without a filename.
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)

        if file and allowed_file(file.filename):
            filename = secure_filename(f"{userid}_{timestamp}.webm")
            file.save(f"{UPLOAD_FOLDER}{filename}")
        else:
            flash('file type not supported')

        global data_semaphore
        global sessionid

        if data_semaphore != 0:
            return jsonify(
                result="Processing audio files ... try again a second later"
            )

        data_semaphore = 1
        upload_count = len(uploaded_data)
        if upload_count == 0:
            sessionid += 1
            uploaded_data.append((userid, timestamp, filename))
        elif upload_count == 1:
            uploaded_data.append((userid, timestamp, filename))
            process_data(sessionid) # run this in a different task/process
        data_semaphore = 0

    return jsonify(
        result = 'OK',
        sessionid = sessionid
    )

@app.route('/result', methods=['POST'])
def show_result():
    if request.method == 'POST':
        params = request.get_json()
        sessionid = int(params['sessionid'])

        session_dir = get_sessiondir(sessionid)
        result_file = f"{session_dir}{RESULT_FILE}"
        try:
            return send_file(
                result_file,
                as_attachment=True,
                attachment_filename=RESULT_FILE
            )
        except FileNotFoundError:
            abort(404)


@app.route('/check_session_complete', methods=['POST'])
def check_session_complete():
    if request.method == 'POST':
        params = request.get_json()
        sessionid = int(params['sessionid'])

        global processingid
        if processingid != 0:
            return jsonify(
                result = 'processing',
                sessionid = sessionid
            )
        else:
            return jsonify(
                result = 'OK',
                sessionid = sessionid
            )
    else:
        return ""

if __name__ == "__main__":
    if not isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)

    if not isdir(RESULT_FOLDER):
        os.mkdir(RESULT_FOLDER)

    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
