# demo_separate_server
BSMinuete 데모를 위한 서버


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


