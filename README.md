# demo_minute_server
BSMinute 데모를 위한 서버


## environment setup
```
  pip install -r requirements.txt
  ```
## request separation
[POST]SERVER_URL:5000/upload
```
request data: FormData({'body':{id:"userid", timestamp:"timestamp"}, 'audio':audioblob}})
response data: json({'result':'OK', 'sessionid':sessionid})
  ```

## request separation test
[POST]SERVER_URL:5000/result
```
request data: json({{'sessionid':sessionid}})
response data: json({{'result':'OK', 'session_contents':json{list of ('userid', timestamp, stt_result)}}})
  ```


---

# environment setup

### A6000 server

```bash
$ssh dev@61.97.244.70
```

### conda env activate

```bash
$conda activate BSminute
```

## execution


```bash
$cd workspace/BSMinutes 
$authbind --deep python demo_minute_server.py
```


### 구조

```
BSMinutes
├── djs/                                  // djs package
├── ssl/                                  // keys for https
├── static/                               // main directory
│   └── src/
│        ├──components/         // !important! 대부분 여기에서 수정하면 됨
│        │   ├──Card.js             // 녹음 데이터
│        │   ├──CardComponent.js    // 메인 페이지
│        │   ├──LoginComponent.js   // Login Page
│        │   ├──Modal.js            // for Modal window
│        │   └──ProfileComponent.js // Profile Component 
│        ├──css/
│        │   └──style.css           // style sheet
│        ├──utils/                  // Font, Hash function 등 utils 기능들
│        ├──App.js                  // main Container 파일
│        └──main.js                 // main 실행 파일
├── static/                         
│    └── index.html                 // 먼저 실행할 html, src/main.js 불러옴 
├── clovaspeechclient.py            // for clova stt function
├── demo_minute_server.py           // main python file for server
└── fix_word_overlap.py             // for stt postprocessing
```

### 수정사항별 위치

- IP주소 변경
```javascript
//static/src/components/card.js:8

const ip = "61.97.244.70:443";


//static/src/components/Modal.js:3

const ip = "61.97.244.70:443";

```

- 녹음시 오류
```javascript
//static/src/components/Modal.js:490

  record() {
    ...//Modal.js:526
    this.mediaRecorder = new MediaRecorder(this.stream, options); //초기화
    ...//Modal.js:569
    this.mediaRecorder.start();
    ...
  }

```

- 서버 시간 받아오는데 오류
```javascript
//static/src/components/Modal.js:490

  record() {
    ...//Modal.js:532
    fetch('https://'+ip+'/get_time')
    ...
  }

```

- 업로드 오류
```javascript
//static/src/components/Modal.js:459

  async okbutton() {
    ...
    await fetch('https://'+ip+'/upload', {
        method: 'POST',
        body: formData,
      })
    ...
  }
```


- stt 결과 받아오는데 오류

```javascript
//static/src/components/Card.js:328

    fetch('https://'+ip+'/result/'+sessionid.padStart(5,'0')+'/stt_result.json')
    .then(Response => Response.json())
    .then(data => {
      ...
    })
```

- 제목 수정 추가하기 ( 현재 비활성화됨 )

```javascript
//static/src/components/Card.js:413

function editButtonEL(e) {
  ...
}

```