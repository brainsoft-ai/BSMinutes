import os
from os.path import isdir
from flask import Flask, flash, request, redirect, url_for, jsonify, render_template
from werkzeug.utils import secure_filename
import json
import torchaudio

UPLOAD_FOLDER = './downloads/'
ALLOWED_EXTENSIONS = {'mp3', 'wav'}
uploaded_data = [] #(id, timestamp, filepath)
processed_data = {}
data_semaphore = 0
sessionid = 0

app = Flask(__name__)
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

def find_max(file1, file2):
    max_specs =  []
    for spec in specs:
        sin_spec, cos_spec = spec
        sin_spec_l, sin_spec_r = sin_spec[0], sin_spec[1]
        cos_spec_l, cos_spec_r = cos_spec[0], cos_spec[1]
        amp_l = (sin_spec_l ** 2 + cos_spec_l ** 2) ** 0.5
        amp_r = (sin_spec_r ** 2 + cos_spec_r ** 2) ** 0.5
        
        l_index = (amp_l >= amp_r)
        r_index = (amp_l <= amp_r)

        sin_spec_l, cos_spec_l = sin_spec_l * l_index, cos_spec_l * l_index
        sin_spec_r, cos_spec_r = sin_spec_r * r_index, cos_spec_r * r_index

        max_specs.append( ((sin_spec_l, cos_spec_l),(sin_spec_r, cos_spec_r)) )


    for idx, name in enumerate(wav_paths):
        l_spec, r_spec = max_specs[idx]
        sin_spec_l, cos_spec_l = l_spec
        sin_spec_r, cos_spec_r = r_spec

        wav_path_name, ext = name.rsplit(".", maxsplit=1)

        wav = generate_inverse_wav(green_djt, djt_config, sin_spec_l, cos_spec_l, dtype_str="float32")
        wavfile.write(f"{wav_path_name}_l.wav", djt_config["sr"], wav)

        wav = generate_inverse_wav(green_djt, djt_config, sin_spec_r, cos_spec_r, dtype_str="float32")
        wavfile.write(f"{wav_path_name}_r.wav", djt_config["sr"], wav)

    return file1, file2

def get_stt(file):
    pass

def process_data():
    user1 = uploaded_data[0][0]
    time1 = uploaded_data[0][1]
    wav1, sr1 = torchaudio.load(uploaded_data[0][2])
    user2 = uploaded_data[1][0]
    time2 = uploaded_data[1][1]
    wav2, sr2 = torchaudio.load(uploaded_data[1][2])

    assert(sr1 == sr2)
    sr = sr1

    wav1, wav2 = sync_audio(wav1, time1, wav2, time2, sr)

    file1, file2 = find_max(wav1, wav2)

    result1 = get_stt(file1)
    result2 = get_stt(file2)

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
            filepath = secure_filename(f"{userid}_{timestamp}_{file.filename}")
            filepath = f"./download/{filepath}"
            file.save(filepath)

        if data_semaphore != 0:
            return jsonify(
                result="Processing audio files ... "
            )

        data_semaphore = 1
        upload_count = len(uploaded_data)
        if upload_count == 0:
            sessionid += 1
            uploaded_data.append((userid, timestamp, filepath))
        elif upload_count == 1:
            uploaded_data.append((userid, timestamp, filepath))
            process_data()
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

    app.run(host="127.0.0.1", port=5000, debug=False, processes=2)
