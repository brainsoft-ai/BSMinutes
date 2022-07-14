import os, sys
from os.path import isdir
import shutil
import ssl
import subprocess
import threading
from flask import Flask, flash, request, redirect, url_for, jsonify, render_template, send_file, send_from_directory
from werkzeug.utils import secure_filename
import json, requests
import torch, torchaudio
from torch.nn.functional import pad
import zipfile
import datetime

from djs.djs import DJS
from djs.djt import DJT

from syncstart import file_offset

from clovaspeechclient import ClovaSpeechClient
from fix_word_overlap import remove_residual_words

RESULT_FOLDER = './results/'
RESULT_FILE = 'result.zip'
UPLOAD_FOLDER = './downloads/'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'webm'}
uploaded_data = [] #(id, timestamp, filepath)
processed_data = {}

data_lock = threading.Lock()

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
        if diff + len(wav2[0]) < len(wav1[0]):
            new_wav1 = wav1[..., -diff - len(wav2[0]) + len(wav1[0]):-diff]
            new_wav2 = wav2
        else:
            new_wav1 = wav1[...,:-diff]
            new_wav2 = wav2[...,diff + len(wav2[0]) - len(wav1[0]):]


    else:
        tdiff = time2 - time1
        diff = (sr // 1000) * tdiff
        if diff + len(wav1[0]) < len(wav2[0]):
            new_wav1 = wav1
            new_wav2 = wav2[:, - diff - len(wav1[0]) + len(wav2[0]):]
        else:
            new_wav1 = wav1[:, diff + len(wav1[0]) - len(wav2[0]):]
            new_wav2 = wav2
    '''
    if time1 > time2:
        tdiff = time1 - time2
        diff = sr * tdiff // 1000
        new_wav1 = wav1
        new_wav2 = wav2[:,diff:]

    else:
        tdiff = time2 - time1
        diff = sr * tdiff // 1000
        new_wav1 = wav1[:,diff:]
        new_wav2 = wav2

    '''
    '''
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
    '''
    len1 = new_wav1.shape[1]
    len2 = new_wav2.shape[1]

    if len1 > len2:
        ldiff = len1 - len2
        new_wav2 = pad(new_wav2, (0, ldiff), 'constant', 0.0)
    else:
        ldiff = len2 - len1
        new_wav1 = pad(new_wav1, (0, ldiff), 'constant', 0.0)
    return new_wav1, new_wav2

def sync_audio2(wavpath1, wavpath2):
    wav1, sr1 = torchaudio.load(wavpath1)
    wav2, sr2 = torchaudio.load(wavpath2)

    wav1, _ = resample_audio(wav1, sr1, SAMPLE_RATE)
    wav2, _ = resample_audio(wav2, sr2, SAMPLE_RATE)
    sr = SAMPLE_RATE

    file_to_cut, offset = file_offset(in1=wavpath1, in2=wavpath2, take=4, show=False)

    if file_to_cut == wavpath1:
        wav1 = wav1[..., int(offset*sr):]
    else:
        wav2 = wav2[..., int(offset*sr):]

    len1 = wav1.shape[1]
    len2 = wav2.shape[1]
    if len1 > len2:
        ldiff = len1 - len2
        wav2 = pad(wav2, (0, ldiff), 'constant', 0.0)
    else:
        ldiff = len2 - len1
        wav1 = pad(wav1, (0, ldiff), 'constant', 0.0)

    return wav1, wav2, sr

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
    print(sr1, sr2)
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

def get_stt_segments(file, lang='ko', stt_engine='naver'):
    if stt_engine.lower() == 'naver':
        #res = naver_transcribe_file(file, lang)
        res = get_ClovaSpeechSR(file, lang)
        json_data = json.loads(res.text)

        if 'segments' in json_data:
            return json_data['segments']
        else:
            return "Error" 

        # json_path = f"./results/stt_result{datetime.datetime.now()}.json"
        # with open(json_path, 'w') as outfile:
        #     json.dump(json_data, outfile, indent=4)

        # if 'segments' in json_data:
        #     segment_data = []
        #     for segment in json_data['segments']:
        #         text_data = {}
        #         text_data['start'] = segment['start']
        #         text_data['end'] = segment['end']
        #         text_data['text'] = segment['text']
        #         segment_data.append(text_data)
        #     return segment_data
        # elif 'text' in json_data:
        #     return json_data['text']
        # else:
        #     return json_data['message']
    elif stt_engine.lower() == 'google':
        return "Not supported yet"
    else:
        return "Error"

def get_session_data(sessionid):
    session_dir = get_sessiondir(sessionid)
    if not isdir(session_dir):
        return "invalid session id"
    else:
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
    temp_zip = f"{RESULT_FOLDER}{RESULT_FILE}"
    final_zip = f"{session_dir}{RESULT_FILE}"

    zipf = zipfile.ZipFile(temp_zip, 'w')
    
    for folder, subfolders, files in os.walk(session_dir):
        for file in files:
            zipf.write(os.path.join(folder, file), os.path.relpath(os.path.join(folder,file), session_dir), compress_type = zipfile.ZIP_DEFLATED)
    
    zipf.close()

    os.rename(temp_zip, final_zip)

def clear_download_data(del_files=True):
    uploaded_data.clear()

    if del_files:
        files = os.listdir(UPLOAD_FOLDER)
        for file in files:
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
    #wav1, wav2 = sync_audio(wav1, time1, wav2, time2, sr)
    wav1, wav2, sr = sync_audio2(filepath_out1, filepath_out2)
    wav = mix_mono2stereo(wav1, 1.0, 0.0, wav2, 0.0, 1.0)
    mix_path = os.path.join(session_dir, "mix.wav")
    torchaudio.save(mix_path, wav, sr)

    # get djs and do find_max
    wav = wav.T.to('cuda')
    djs = djt_mix.wav2djs(wav)
    djs1, djs2 = find_max(djs)

    # save processed djs to wav
    file_out1 = f"{user1}.wav"
    new_path1 = f"{session_dir}{file_out1}"
    wav1 = djt_inv.djs2wav(djs1, save=True, wav_path=new_path1)
    file_out2 = f"{user2}.wav"
    new_path2 = f"{session_dir}{file_out2}"
    wav2 = djt_inv.djs2wav(djs2, save=True, wav_path=new_path2)


    # get stt and save them
    stt_result = {}
    stt_segments1 = get_stt_segments(new_path1)
    stt_segments2 = get_stt_segments(new_path2)
    stt_result[user1], stt_result[user2] = remove_residual_words(stt_segments1, djs1, stt_segments2, djs2)

    stt_result_path = f"{session_dir}stt_result.json"
    with open(stt_result_path, 'w') as outfile:
        json.dump(stt_result, outfile, indent=4)

    zip_session_content(sessionid)

    clear_download_data(del_files=False)
    processingid = 0

def process_stereo(sessionid, userid, timestamp, filepath):
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

    stereo_file = filepath
    wav, sr = torchaudio.load(filepath)
    wav, sr = resample_audio(wav, sr, SAMPLE_RATE)
    ch = len(wav)

    user1 = userid+"_L"
    user2 = userid+"_R"

    # sync and mix audio files
    #wav1, wav2, sr = sync_audio2(filepath_out1, filepath_out2)
    wav = mix_mono2stereo(wav1, 1.0, 0.0, wav2, 0.0, 1.0)
    mix_path = os.path.join(session_dir, "mix.wav")
    torchaudio.save(mix_path, wav, sr)

    # get djs and do find_max
    wav = wav.T.to('cuda')
    djs = djt_mix.wav2djs(wav)
    djs1, djs2 = find_max(djs)

    # save processed djs to wav
    file_out1 = f"{user1}.wav"
    new_path1 = f"{session_dir}{file_out1}"
    wav1 = djt_inv.djs2wav(djs1, save=True, wav_path=new_path1)
    file_out2 = f"{user2}.wav"
    new_path2 = f"{session_dir}{file_out2}"
    wav2 = djt_inv.djs2wav(djs2, save=True, wav_path=new_path2)


    # get stt and save them
    stt_result = {}
    stt_segments1 = get_stt_segments(new_path1)
    stt_segments2 = get_stt_segments(new_path2)
    stt_result[user1], stt_result[user2] = remove_residual_words(stt_segments1, djs1, stt_segments2, djs2)

    stt_result_path = f"{session_dir}stt_result.json"
    with open(stt_result_path, 'w') as outfile:
        json.dump(stt_result, outfile, indent=4)

    zip_session_content(sessionid)

    clear_download_data(del_files=False)
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

@app.route('/get_time', methods=['GET'])
def server_time():
    a = int(datetime.datetime.utcnow().timestamp()*1000)
    print(a)
    return str(a)

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

        global data_lock
        global sessionid

        data_lock.acquire()
        upload_count = len(uploaded_data)
        if upload_count == 0:
            sessionid += 1
            uploaded_data.append((userid, timestamp, filename))
        elif upload_count == 1:
            # ignore if the userid is same as before
            if userid == uploaded_data[0][0]:
                pass
            else:
                uploaded_data.append((userid, timestamp, filename))

                t = threading.Thread(target=process_data, args=(sessionid,))
                t.start()
                #process_data(sessionid)
        data_lock.release()

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

@app.route('/upload_onephone', methods=['POST'])
def upload_onephone():
    if request.method == 'POST':
        # need to check out file retrieve method when frontend is actually implemented
        filepath = ""
        userid = ""
        timestamp = 0
        print('upload_onephone', file=sys.stderr)
        file = None

        if 'file' in request.files:
            file = request.files['file']
            print(f'upload_onephone: file = {file}', file=sys.stderr)
        else:
            print('no file in POST data', file=sys.stderr)
            flash('no file in POST data')
            return redirect(request.url)
        if 'id' in request.form:
            userid = request.form['id']
            print(f'upload_onephone: id = {userid}', file=sys.stderr)
        else:
            print('no user id in POST data', file=sys.stderr)
            flash('no user id in POST data')
            return redirect(request.url)
        if 'timestamp' in request.form:
            timestamp = request.form['timestamp']
            print(f'upload_onephone: timestamp = {timestamp}', file=sys.stderr)
        else:
            print('no timestamp in POST data', file=sys.stderr)
            flash('no timestamp in POST data')
            return redirect(request.url)

        if file != None:
            filename = secure_filename(f"{userid}_{timestamp}_{file.filename}")
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
        else:
            print('no file in POST data', file=sys.stderr)
            flash('no file in POST data')
            return redirect(request.url)

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

        global data_lock
        global sessionid

        data_lock.acquire()
        sessionid += 1
        t = threading.Thread(target=process_stereo, args=(sessionid, userid, timestamp, filepath))
        t.start()
        data_lock.release()

    return jsonify(
        result = 'OK',
        sessionid = sessionid
    )

    # if request.method == 'POST':
    #     if 'file' in request.files:
    #         blob = request.files['file'].read()
    #         size = len(blob)
    #         dtype = "formdata file"
    #     else:
    #         size = len(request.data)
    #         dtype = "binary file"
    
    # global sessionid
    # process_stereo()

    # return jsonify(
    #     result = 'OK',
    #     sessionid = sessionid
    # )  

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
    else:
        files = os.listdir(UPLOAD_FOLDER)
        for file in files:
            path = os.path.join(UPLOAD_FOLDER, file)
            os.remove(path)

    if not isdir(RESULT_FOLDER):
        os.mkdir(RESULT_FOLDER)
    else:
        files = os.listdir(RESULT_FOLDER)
        for file in files:
            path = os.path.join(RESULT_FOLDER, file)
            shutil.rmtree(path)        

    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS)
    ssl_context.load_cert_chain(certfile='ssl/cert.pem', keyfile='ssl/key.pem', password='louie')

    app.config["SESSION_TYPE"] = "filesystem"
    app.config["SECRET_KEY"] = "super sekret key"
    app.run(host="0.0.0.0", port=443, debug=True, threaded=True, ssl_context=ssl_context)
