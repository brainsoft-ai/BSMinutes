import { UserStorage, LangStorage } from "../utils/CustomStorage.js";

const ip = "61.97.244.70:443";

export default class Modal {
  constructor({ $target }) {
    this.$target = $target;
    this.$modalContainer = this.createModal();
    this.data = null;
    this.closeModal = this.closeModal.bind(this);
    this.record = this.record.bind(this);
    this.ok = this.ok.bind(this);
    this.okbutton = this.okbutton.bind(this);
    this.uploadbutton = this.uploadbutton.bind(this);
    
    this.timer;
    this.recordedChunks = []; // will be used later to record audio
    this.mediaRecorder = null; // will be used later to record audio
    this.audioBlob = null; // the blob that will hold the recorded audio
    this.onContinue = null;
    this.stream = null;
    this.timestamp = false;
  }

  createModal() {
    const $modalContainer = document.createElement("div");
    $modalContainer.className = "modal-container hidden";

    const $modalBackground = document.createElement("div");
    $modalBackground.className = "modal__background";
    $modalBackground.addEventListener("click", this.closeModal);

    const $modalContent = document.createElement("div");
    $modalContent.className = "modal__content hidden";

    const $modalCloseBtn = document.createElement("button");
    $modalCloseBtn.className = "modal-content__close";
    $modalCloseBtn.innerHTML = '<i class="fas fa-times"></i>';
    $modalCloseBtn.addEventListener("click", this.closeModal);

    const $modalTitle = document.createElement("span");
    $modalTitle.className = "modal-content__title";

    const $modalText = document.createElement("ul");
    $modalText.className = "modal-content__text hidden";

    const $modalHTML = document.createElement("div");
    $modalHTML.className = "modal-content__html hidden";

    const $modalAudio = document.createElement("audio");
    $modalAudio.className = "modal-content__audio hidden";
        
    const $loader = document.createElement("div");
    $loader.className = "modal-content__loader hidden";
    $loader.innerHTML = `<svg id="loader" class="mt-5 mb-3 d-none" version="1.1" id="L4" width="130px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
    viewBox="0 0 74 60" enable-background="new 0 0 0 0" xml:space="preserve">
    <defs>
      <linearGradient id="grad_svg" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--color-stop)" />
        <stop offset="100%" stop-color="var(--color-start)" />
      </linearGradient>
    </defs>
    <rect x="0" y="25" rx="5" ry="5" width="4" height="10">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0"/>
    </rect>
    <rect x="7" y="20" rx="5" ry="5" width="4" height="20">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0"/>    
    </rect>
    <rect x="14" y="15" rx="5" ry="4" width="4" height="30">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.1s"/>    
    </rect>
    <rect x="21" y="13" rx="5" ry="4" width="4" height="34">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.2s"/>    
    </rect>
    <rect x="28" y="17" rx="5" ry="4" width="4" height="26">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.3s"/>    
    </rect>
    <rect x="35" y="20" rx="5" ry="5" width="4" height="20">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.4s"/>    
    </rect>
    <rect x="42" y="17" rx="5" ry="4" width="4" height="26">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.5s"/>    
    </rect>
    <rect x="49" y="13" rx="5" ry="4" width="4" height="34">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.6s"/>    
    </rect>
    <rect x="56" y="15" rx="5" ry="4" width="4" height="30">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.7s"/>    
    </rect>
    <rect x="63" y="20" rx="5" ry="5" width="4" height="20">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.8s"/>    
    </rect>
    <rect x="70" y="25" rx="5" ry="5" width="4" height="10">
      <animate
        attributeName="opacity"
        dur="2s"
        values="0;1;0"
        repeatCount="indefinite"
        begin="0.9s"/>    
    </rect>
  </svg>`;
    const $timewatch = document.createElement("div");
    $timewatch.className = "modal-content__timewatch hidden";
    $timewatch.innerText = "00 : 00"

    const $modalTimestamp = document.createElement("div");
    $modalTimestamp.className = "modal-content__timestamp hidden";

    const $modalUpload = document.createElement("div");
    $modalUpload.className = "modal-content__upload";

    const $modalFilename = document.createElement("input");
    $modalFilename.value = "??????????????? ????????????";
    $modalFilename.placeholder = "??????????????? ????????????";
    $modalFilename.disabled = true;
    $modalFilename.className = "modal-content__filename";

    const $modalFileBtn = document.createElement("label");
    $modalFileBtn.htmlFor = "file";
    $modalFileBtn.textContent = "????????????"
    $modalFileBtn.className = "modal-content__filebtn";

    const $modalFile = document.createElement("input");
    $modalFile.type = "file";
    $modalFile.accept= "audio/*";
    $modalFile.id = "file";
    $modalFile.className = "modal-content__file hidden";
    $modalFile.addEventListener('change', () => {
      $modalFilename.value = $modalFile.value.split("\\").reverse()[0];
      $modalOkBtn.classList.remove("nope"); 
      $modalOkBtn.addEventListener("click", this.uploadbutton);
    })

    const $modalRec = document.createElement("button");
    $modalRec.className = "modal-content__rec hidden";

    const $modalRecBtn = document.createElement("div");
    $modalRecBtn.className = "modal-content__recbtn";

    const $modalOkBtn = document.createElement("button");
    $modalOkBtn.className = "modal-content__ok";
    $modalOkBtn.textContent = LangStorage.isEnglish() ? "Continue" : "??????";

    $modalContent.appendChild($modalCloseBtn);
    $modalContent.appendChild($modalTitle);
    $modalContent.appendChild($modalText);
    $modalContent.appendChild($modalHTML);
    $modalContent.appendChild($modalAudio);
    $loader.appendChild($timewatch);
    $modalContent.appendChild($loader);
    $modalContent.appendChild($modalTimestamp);
    $modalUpload.appendChild($modalFilename);
    $modalUpload.appendChild($modalFileBtn);
    $modalUpload.appendChild($modalFile);
    $modalContent.appendChild($modalUpload);
    $modalRec.appendChild($modalRecBtn);
    $modalContent.appendChild($modalRec);
    $modalContent.appendChild($modalOkBtn);
    $modalContainer.appendChild($modalBackground);
    $modalContainer.appendChild($modalContent);
    this.$target.appendChild($modalContainer);

    return $modalContainer;
  }

  async renderModal() {
    let {
      title,
      text,
      html,
      btn,
      onContinue,
      onLogout,
      htmlMinHeight,
      modalMinHeight,
      hideContinue,
    } = this.data;

    this.onContinue = onContinue;
    this.onLogout = onLogout;

    const $modal = this.$modalContainer.querySelector(".modal__content");

    if (modalMinHeight) {
      $modal.style.minHeight = `${modalMinHeight}px`;
    }

    const $modalTitle = this.$modalContainer.querySelector(
      ".modal-content__title"
    );
    $modalTitle.textContent = title;

    if (text) {
      const $modalText = this.$modalContainer.querySelector(
        ".modal-content__text"
      );

      $modalText.classList.remove("hidden");

      text.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        $modalText.appendChild(li);
      });
    }

    if (html) {
      const { data, type } = html;

      const $modalHTML = this.$modalContainer.querySelector(
        ".modal-content__html"
      );

      if (htmlMinHeight) {
        $modalHTML.style.minHeight = `${htmlMinHeight}px`;
      }

      $modalHTML.classList.remove("hidden");

      if (type === "string") {
        $modalHTML.innerHTML = data;
      } else if (type === "element") {
        $modalHTML.appendChild(data);
      }
    }


    let record, ok;
    if (btn) {
      record = btn.record;
      
      const $modalAudio = this.$modalContainer.querySelector(
        ".modal-content__audio"
      );

      const $modalRec = this.$modalContainer.querySelector(
        ".modal-content__rec"
      );

      const $modalUpload = this.$modalContainer.querySelector(
        ".modal-content__upload"
      );

      const $modalOkBtn = this.$modalContainer.querySelector(
        ".modal-content__ok"
      );
      
      if(record){
        //Record
        $modalRec.classList.remove("hidden");
        $modalRec.classList.remove("hidden");

        if(!this.mediaRecorder){
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              //echoCancellation: false,
              noiseSuppression: false,
              //autoGainControl: false,
            },
          })
        }
        $modalRec.addEventListener("click", this.record);
        $modalOkBtn.classList.add("nope");
      }
      else{
        //Logout
        $modalUpload.classList.add("hidden");
        $modalRec.classList.add("hidden");
        $modalOkBtn.classList.remove("nope");
        $modalOkBtn.addEventListener("click", this.ok);
      }

      if (hideContinue) {
        $modalOkBtn.classList.add("hidden");
      } else {
        $modalOkBtn.classList.remove("hidden");
      }
    }
  }

  closeModal() {
    console.log(this);
    
    const $modalContainer = document.querySelector(
      ".modal-container"
    );

    $modalContainer.classList.add("hidden");

    const $modalContent = $modalContainer.querySelector(".modal__content");
    $modalContent.classList.add("hidden");

    $modalContent.querySelector(".modal-content__title").textContent = "";
    $modalContent.querySelector(".modal-content__text").innerHTML = "";
    $modalContent.querySelector(".modal-content__html").innerHTML = "";

    $modalContent.querySelector(".modal-content__text").classList.add("hidden");
    $modalContent.querySelector(".modal-content__html").classList.add("hidden");

    const $modalAudio = $modalContainer.querySelector(
      ".modal-content__audio"
    );

    const $loader = $modalContainer.querySelector(
      ".modal-content__loader"
    );

    const $modalUpload = $modalContainer.querySelector(
      ".modal-content__upload"
    );

    const $modalRec = $modalContainer.querySelector(
      ".modal-content__rec"
    );

    const $modalOkBtn = $modalContainer.querySelector(
      ".modal-content__ok"
    );
    
    $modalAudio.classList.add("hidden");
    $modalUpload.classList.remove("hidden");
    
    if($loader.classList.contains('hidden') == false){
      $modalRec.click();
    }

    $modalRec.removeEventListener("click", this.record);
    $modalOkBtn.removeEventListener("click", this.ok);
    
    /*
    const $RecordBtn = $modalContent.querySelector(".modal-content__rec");
    $RecordBtn.outerHTML = $RecordBtn.outerHTML;
    */
  }
  
  async uploadbutton() {
    const $modalFile = this.$modalContainer.querySelector(
      ".modal-content__file"
    );

    const $modalOkBtn = this.$modalContainer.querySelector(
      ".modal-content__ok"
    );

    $modalOkBtn.removeEventListener("click", this.uploadbutton);

    const formData = new FormData();
    fetch('https://'+ip+'/get_time')
    .then(response => response.text())
    .then(async(result) => {
      const temp = JSON.stringify({
        id: UserStorage.getUserData(),
        timestamp: result});
      
      formData.append('body', temp);
      formData.append('audio', $modalFile.files[0], $modalFile.files[0].name);
        
      await fetch('https://'+ip+'/upload', {
        method: 'POST',
        body: formData,
      })
      .then((response) => response.json())
      .then((result) => {
        const $session = document.querySelector(".session-container");
        $session.textContent = result.sessionid;

        const $filter = document.querySelector(".modal-content__ok");
        
        if (($filter && !$filter.matches(".nope")) || !$filter) { 
          this.onContinue();
          this.closeModal();
          $filter.classList.add("nope");
        }
      });
    })
  }
    
  
  async okbutton() {
    
    const $modalAudio = this.$modalContainer.querySelector(
      ".modal-content__audio"
    );

    const $modalRec = this.$modalContainer.querySelector(
      ".modal-content__rec"
    );
    const $modalRecBtn = $modalRec.querySelector(".modal-content__recbtn");
    const $modalOkBtn = this.$modalContainer.querySelector(
      ".modal-content__ok"
    );

    $modalOkBtn.removeEventListener("click", this.okbutton);
    const text = document.querySelector(".todo__input").value;
    if (text.length <= 14) {
        
      const formData = new FormData();
      const timestamp = document.querySelector('.modal-content__timestamp').textContent;

      const ext = ["audio/webm", "audio/ogg", "audio/mp4"]
      .filter(MediaRecorder.isTypeSupported)[0].slice(6);

      const temp = JSON.stringify({
        id: UserStorage.getUserData(),
        timestamp: timestamp});
      formData.append('body', temp);
      formData.append('audio', this.audioBlob, 'recording.'+ext);
      
      await fetch('https://'+ip+'/upload', {
        method: 'POST',
        body: formData,
      })
      .then((response) => response.json())
      .then((result) => {
        const $session = document.querySelector(".session-container");
        $session.textContent = result.sessionid;

        $modalAudio.classList.add("hidden");
        const $filter = document.querySelector(".modal-content__ok");
        
        if (($filter && !$filter.matches(".nope")) || !$filter) { 
          this.onContinue();
          this.closeModal();
          $filter.classList.add("nope");
          $modalRecBtn.classList.remove("focused");
        }
      });
    }
  }

  ok() {
    const $filter = document.querySelector(".modal-content__ok");
    if (($filter && !$filter.matches(".nope")) || !$filter) {
      this.onLogout();
      this.closeModal();
      $filter.classList.add("nope");
    }
  }

  record() {

    const $modalAudio = this.$modalContainer.querySelector(
      ".modal-content__audio"
    );

    const $loader = this.$modalContainer.querySelector(
      ".modal-content__loader"
    );

    const $timewatch = this.$modalContainer.querySelector(
      ".modal-content__timewatch"
    );

    const $modalUpload = this.$modalContainer.querySelector(
      ".modal-content__upload"
    );

    const $modalRec = this.$modalContainer.querySelector(
      ".modal-content__rec"
    );

    const $modalOkBtn = this.$modalContainer.querySelector(
      ".modal-content__ok"
    );

    if(!this.mediaRecorder){
        const mime = ["audio/ogg\;codecs=opus", "audio/webm\;codecs=opus", "audio/mp4"]
        .filter(MediaRecorder.isTypeSupported)[0];
        
        var options = 
        {
            type: "audio",
            mimeType: mime,
            audioBitsPerSecond: 128000,
        };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        

        this.mediaRecorder.ondataavailable = (event)=>{
          if (event.data.size > 0) this.recordedChunks.push(event.data); // ????????? ???????????? ????????? ????????? ????????? ????????????.
          if(this.timestamp == false){
            fetch('https://'+ip+'/get_time')
            .then(response => response.text())
            .then(result => {
              document.querySelector('.modal-content__timestamp').textContent = result;
            })
            this.timestamp = true;
          }
        }

        this.mediaRecorder.onstop = ()=>{
          $modalAudio.setAttribute('controls', ''); // add controls
          this.audioBlob = new Blob(this.recordedChunks, { type: 'audio/mp3' });
          const audioURL = window.URL.createObjectURL(this.audioBlob);
          $modalAudio.src = audioURL;
          $modalAudio.classList.remove("hidden");
          this.recordedChunks = [];
          //$modal.insertBefore(audioElm, $modalRec);
        }
    }
    
    $modalUpload.classList.add("hidden");
    const $modalRecBtn = $modalRec.querySelector(".modal-content__recbtn");
    if($modalRecBtn.classList.contains("focused")){
      $modalRecBtn.classList.remove("focused");
      this.timestamp = false;
      this.mediaRecorder.stop();
      $modalOkBtn.classList.remove("nope"); 
      $loader.classList.add("hidden");
      $timewatch.classList.add("hidden");

      $modalOkBtn.addEventListener("click", this.okbutton);
      clearInterval(this.timer);
      $timewatch.innerText = `00 : 00`;
    }
    else{
      
      $modalRecBtn.classList.add("focused");
      this.mediaRecorder.start();
      $loader.classList.remove("hidden");
      $timewatch.classList.remove("hidden");
      $timewatch.innerText = `00 : 00`;

      this.timer = setInterval(function(){
        let seconds = parseInt($timewatch.innerText.slice(5));
        seconds = seconds + 1;
        let minutes = parseInt($timewatch.innerText.slice(0,2));
        minutes = minutes + parseInt(seconds / 60);
        if(seconds>=60){
          seconds = seconds - 60;
        }
        $timewatch.innerText = `${minutes<10 ? `0${minutes}`:minutes} : ${seconds<10 ? `0${seconds}`:seconds}`;
      }, 1000);
      
      $modalAudio.classList.add("hidden");
    }
    
  }
  

  setState(nextData) {
    this.data = nextData; // title, text, html, onContinue, htmlMinHeight, modalMinHeight, hideContinue

    const modal = this.$modalContainer;
    modal.classList.remove("hidden");

    const modalContent = modal.querySelector(".modal__content");
    modalContent.classList.remove("hidden");

    this.renderModal();
  }
}
