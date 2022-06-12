import os
from os.path import isdir
from flask import Flask, flash, request, redirect, url_for, jsonify, render_template
from werkzeug.utils import secure_filename
import json
import torchaudio, librosa
from djs.djs import DJS
from djs.djt import DJT

RESULT_FOLDER = './results/'
UPLOAD_FOLDER = './downloads/'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'webm'}
uploaded_data = [] #(id, timestamp, filepath)
processed_data = {}
data_semaphore = 0
sessionid = 0

app = Flask(__name__,
            static_url_path='', 
            static_folder='static',
            template_folder='templates')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


def sync_audio(wav1, time1, wav2, time2, sr):

    if time1 > time2:
        tdiff = time1 - time2
        diff = sr * tdiff
        new_wav1 = wav1
        new_wav2 = wav2[diff:]
    else:
        tdiff = time2 - time1
        diff = sr * tdiff
        new_wav1 = wav1[diff:]
        new_wav2 = wav2

    return new_wav1, new_wav2

def mix_mono2stereo(wav_data1, ratio1_l, ratio1_r, wav_data2, ratio2_l, ratio2_r):
    wav_data_l = wav_data1 * ratio1_l + wav_data2 * ratio2_l
    wav_data_r = wav_data1 * ratio1_r + wav_data2 * ratio2_r
    wav_data = torch.stack([wav_data_l, wav_data_r]).transpose(1, 0)

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
    spec_l = DJS(sin_spec_l, cos_spec_l, spec.get_config())
    sin_spec_r, cos_spec_r = sin_spec_r * r_index, cos_spec_r * r_index
    spec_r = DJS(sin_spec_r, cos_spec_r, spec.get_config())

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

def get_stt(file, lang, stt_engine='naver'):
    if stt_engine.lower() == 'naver':
        return naver_transcribe_file(file, lang)
    else:
        return "Error"


def get_session_data(sessionid):
    session_dir = f"{RESULT_FOLDER}{sessionid:05d}"
    if not isdir(session_dir):
        return "invalid session id"
    else:
        #remove existing files
        pass

def process_data(sessionid):
    user1 = uploaded_data[0][0]
    time1 = uploaded_data[0][1]
    file1 = uploaded_data[0][2]
    #wav1, sr1 = torchaudio.load(f"{UPLOAD_FOLDER}{file1}")
    wav1, sr1 = librosa.load(f"{UPLOAD_FOLDER}{file1}")
    ch1 = len(wav1)

    user2 = uploaded_data[1][0]
    time2 = uploaded_data[1][1]
    file2 = uploaded_data[1][2]
    wav2, sr2 = torchaudio.load(f"{UPLOAD_FOLDER}{file2}")
    ch2 = len(wav2)

    assert(sr1 == sr2 and ch1 == ch2)
    sr = sr1
    ch = ch1

    wav1, wav2 = sync_audio(wav1, time1, wav2, time2, sr)
    wav = mix_mono2stereo(wav1, 1.0, 0.0, wav2, 0.0, 1.0)

    djt = DJT(sample_rate=sr, channels=ch)
    djs = djt.wav2djs(wav)
    djs1, djs2 = find_max(djs)

    session_dir = f"{RESULT_FOLDER}{sessionid:05d}"
    if not isdir(session_dir):
        os.mkdir(session_dir)
    else:
        #remove existing files
        pass

    new_path1 = f"{session_dir}/{file1}"
    wav1 = djt.djs2wav(djs1, save=True, wav_path=new_path1)
    new_path2 = f"{session_dir}/{file2}"
    wav2 = djt.djs2wav(djs2, save=True, wav_path=new_path2)

    result1 = get_stt(new_path_1)
    result2 = get_stt(new_path_2)

    uploaded_data.clear()

@app.route('/')
def index():
    return render_template("index.html")


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
            filename = secure_filename(f"{timestamp}_{userid}_{file.filename}")
            filename = filename[:-4]+"mp3"
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
            process_data(sessionid)
        data_semaphore = 0

    return jsonify(
        result = 'OK',
        sessionid = sessionid
    )

@app.route('/result', methods=['POST'])
def show_result():
    return jsonify(
        "",
        ""
    )

if __name__ == "__main__":
    if not isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)

    if not isdir(RESULT_FOLDER):
        os.mkdir(RESULT_FOLDER)

    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
