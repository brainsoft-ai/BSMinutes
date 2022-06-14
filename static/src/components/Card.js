import {
  CardStorage,
  LangStorage,
  UserStorage,
} from "../utils/CustomStorage.js";
import { Hash } from "../utils/Hash.js";

function convertTime(milliSecond) {
  const hour = String(Math.floor((milliSecond/ (1000 * 60 *60 )) % 24 )).padStart(2, "0"); // 시
  const minutes = String(Math.floor((milliSecond  / (1000 * 60 )) % 60 )).padStart(2, "0"); // 분
  const second = String(Math.floor((milliSecond / 1000 ) % 60)).padStart(2, "0"); // 초
  const milli = String(Math.floor((milliSecond / 10 ) % 60)).padStart(2, "0"); // 0.01초
  return `${hour}:${minutes}:${second}.${milli}`;
}

export default class Card {
  constructor(
    {
      countdown,
      text,
      updatedAt,
      createdAt,
      cardComponent,
      salt,
      id,
      modal,
      pinned,
      sessionid,
    },
    isComplete = false
  ) {
    this.sessionid = sessionid;
    this.pinned = pinned;
    this.countdown = countdown;
    this.text = text;
    this.updatedAt = updatedAt || this.getCurTime.bind(this)();
    this.createdAt = createdAt || this.getCurTime.bind(this)();
    this.cardComponent = cardComponent;
    this.modal = modal;
    this.salt = salt || Hash.getSalt();
    this.id = id || Hash.createHash(text + this.salt);
    this.element = this.createCardElement.bind(this)(isComplete);

    this.counter = this.setCounter.bind(this)();
  }

  setCounter() {
    if (!this.countdown) return;
    
    const $countdown = this.element.querySelector(".card__countdown");
    let { hour, min, sec } = this.getLeftTime(this.countdown);
    
    if (hour === 0) {
      if (min < 10) min = `0${min}`;
      if (sec < 10) sec = `0${sec}`;
      $countdown.innerHTML = LangStorage.isEnglish()
        ? `<span class='countdown__time'>${min}</span> min <span class='countdown__time'>${sec}</span> sec`
        : `<span class='countdown__time'>${min}</span> 분 <span class='countdown__time'>${sec}</span> 초`;
      return;
    }

    if (hour < 10) hour = `0${hour}`;
    if (min < 10) min = `0${min}`;
    if (sec < 10) sec = `0${sec}`;

    $countdown.innerHTML = LangStorage.isEnglish()
      ? `<span class='countdown__time'>${hour}</span> hour <span class='countdown__time'>${min}</span> min <span class='countdown__time'>${sec}</span> sec`
      : `<span class='countdown__time'>${hour}</span> 시간 <span class='countdown__time'>${min}</span> 분 <span class='countdown__time'>${sec}</span> 초`;
  
    /*
    return setInterval(() => {
      const $countdown = this.element.querySelector(".card__countdown");
      let { hour, min, sec } = this.getLeftTime();

      if (hour + min + sec === 0) {
        $countdown.innerHTML = LangStorage.isEnglish()
          ? "<span class='countdown__time end'>Time Over</span>"
          : "<span class='countdown__time end'>시간 종료</span>";

        clearInterval(this.counter);

        return;
      }

      if (hour + min === 0) {
        if (sec < 10) sec = `0${sec}`;
        $countdown.innerHTML = LangStorage.isEnglish()
          ? `<span class='countdown__time end-soon'>${sec}</span> sec`
          : `<span class='countdown__time end-soon'>${sec}</span> 초`;
        return;
      }

      if (hour === 0) {
        if (min < 10) min = `0${min}`;
        if (sec < 10) sec = `0${sec}`;
        $countdown.innerHTML = LangStorage.isEnglish()
          ? `<span class='countdown__time'>${min}</span> min <span class='countdown__time'>${sec}</span> sec`
          : `<span class='countdown__time'>${min}</span> 분 <span class='countdown__time'>${sec}</span> 초`;
        return;
      }

      if (hour < 10) hour = `0${hour}`;
      if (min < 10) min = `0${min}`;
      if (sec < 10) sec = `0${sec}`;

      $countdown.innerHTML = LangStorage.isEnglish()
        ? `<span class='countdown__time'>${hour}</span> hour <span class='countdown__time'>${min}</span> min <span class='countdown__time'>${sec}</span> sec`
        : `<span class='countdown__time'>${hour}</span> 시간 <span class='countdown__time'>${min}</span> 분 <span class='countdown__time'>${sec}</span> 초`;
    }, 1000);*/
  }

  getLeftTime(leftTime) {
    /*
    const curTime = new Date();
    const createdTime = new Date(this.createdAt);

    const elapsedTime = Math.floor((curTime - createdTime) / 1000);

    let { hour, min } = this.countdown;
    hour = parseInt(hour);
    min = parseInt(min);

    const countDownTime = hour * 3600 + min * 60;
    const leftTime = countDownTime - elapsedTime;

    */
   console.log(leftTime);
    if (leftTime <= 0) {
      return {
        hour: 0,
        min: 0,
        sec: 0,
      };
    }
    return {
      hour: Math.floor(leftTime / 3600),
      min: Math.floor((leftTime % 3600) / 60),
      sec: Math.floor((leftTime % 3600) % 60),
    };
  }

  getCurTime() {
    const time = new Date();

    const year = `${time.getFullYear()}`;
    let month = time.getMonth() + 1;
    let date = time.getDate();
    let hour = time.getHours();
    let min = time.getMinutes();
    let sec = time.getSeconds();

    if (month < 10) month = `0${month}`;
    if (date < 10) date = `0${date}`;
    if (hour < 10) hour = `0${hour}`;
    if (min < 10) min = `0${min}`;
    if (sec < 10) sec = `0${sec}`;

    return `${year}-${month}-${date}T${hour}:${min}:${sec}`;
  }

  createCardElement(isComplete) {
    
    function spliceCardFromToDo($card, cardComponent) {
      if (
        cardComponent.cards.pinnedTodo &&
        cardComponent.cards.pinnedTodo.element === $card
      ) {
        const tmp = cardComponent.cards.pinnedTodo;
        cardComponent.cards.pinnedTodo = null;
        return tmp;
      }

      const todoCards = cardComponent.cards.todo;
      let cardIdx = -1;

      for (let i = 0; i < todoCards.length; i++) {
        if (todoCards[i].element === $card) {
          cardIdx = i;
          break;
        }
      }

      return todoCards.splice(cardIdx, 1)[0];
    }

    function spliceCardFromComplete($card, cardComponent) {
      if (
        cardComponent.cards.pinnedComplete &&
        cardComponent.cards.pinnedComplete.element === $card
      ) {
        const tmp = cardComponent.cards.pinnedComplete;
        cardComponent.cards.pinnedComplete = null;
        return tmp;
      }

      const completeCards = cardComponent.cards.complete;
      let cardIdx = -1;

      for (let i = 0; i < completeCards.length; i++) {
        if (completeCards[i].element === $card) {
          cardIdx = i;
          break;
        }
      }

      return completeCards.splice(cardIdx, 1)[0];
    }

    function toggleMenuButtonEL_click(e) {
      let $toggleMenuButton = e.target;

      if (!$toggleMenuButton.matches(".toggle")) {
        $toggleMenuButton = $toggleMenuButton.parentNode;
      }

      const $cardMenuContainer = $toggleMenuButton.parentNode;

      if ($cardMenuContainer.classList.contains("active")) {
        $toggleMenuButton.blur();
        $cardMenuContainer.classList.remove("active");
        $toggleMenuButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
      } else {
        $cardMenuContainer.classList.add("active");
        $toggleMenuButton.innerHTML = '<i class="fas fa-times"></i>';
      }
    }

    function toggleMenuButtonEL_focusout(e) {
      let $toggleMenuButton = e.target;
      if (!$toggleMenuButton.matches(".toggle")) {
        $toggleMenuButton = $toggleMenuButton.parentNode;
      }
      const $cardMenuContainer = $toggleMenuButton.parentNode;
      $cardMenuContainer.classList.remove("active");
      $toggleMenuButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
    }


    async function completeButtonEL(e) {
      e.stopPropagation();

      let $target = e.target;

      if (e.target.classList.contains("fas")) {
        $target = $target.parentNode;
      }


      const $toggleBtn = $cardMenuContainer.querySelector(".toggle");
      $toggleBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
      $toggleBtn.addEventListener("click", toggleMenuButtonEL_click);
      $toggleBtn.addEventListener("focusout", toggleMenuButtonEL_focusout);

      const $card = $target.parentNode.parentNode;
      $card.parentNode.classList.add("end");
      console.log($card.id);
      
      const $addCardButton = document.querySelector(".add-card-button");
      $addCardButton.classList.add("animation");
      
      const $filterContainer = document.querySelector(".filter-container");

      const $resultContainer = document.querySelector(".result-container");
      
      async function passout(e) {
        e.target.removeEventListener("animationend", passout)
        e.target.classList.add("hidden");
        e.target.classList.remove("end");
        $filterContainer.classList.add("hidden");
        $addCardButton.classList.add("hidden");
        $addCardButton.classList.remove("animation");
        const $card_text = $card.querySelector(".card__text").cloneNode(true);
        $card_text.classList.add("detail");
        
        const $card_date = $card.querySelector(".card__date-container").cloneNode(true);

        const $modalAudio = document.createElement("audio");
        $modalAudio.className = "modal-content__audio";
        $modalAudio.controls = true;
        const $resultText = document.createElement("div");
        $resultText.className = "result-text";

        const $resultBack = document.createElement("div");
        $resultBack.className = "result-back";
        $resultBack.innerHTML =
          '<i class="fas fa-arrow-left"></i>';
        $resultBack.addEventListener("click", () => {
          document.querySelector('.add-card-button').classList.remove("hidden");
          document.querySelector('.filter-container').classList.remove("hidden");
          document.querySelector('.all-card-container').classList.remove("hidden");
        });


        $resultContainer.innerHTML = '';

        
        const sessionid = $card.querySelector(".card__session-container").textContent;
        await fetch('http://192.168.130.102:5000/check_session_complete', {
          method: 'POST',
          headers: {
            "Content-Type": "application/json"
          },
          body : JSON.stringify({
            "sessionid": sessionid,
          }),
        })
        .then((response)=>(response.json()))
        .then((result) => {
          if(result["result"] == "processing"){
            $resultText.textContent = "작업 중입니다."
          }
          else{
            fetch('http://192.168.130.102:5000/result/'+sessionid.padStart(5,'0')+'/stt_result.json')
              .then(Response => Response.json())
              .then(data => {
                  let results = [];
                  for(var key in data){
                    data[key].slice(0).forEach(function(item){
                    item["user"] = key;
                    results.push(item);
                    })
                  }
                  results.sort(function(a,b) {
                    return a.start - b.start;
                  });
                  results.forEach(function(item){
                    const $sentenceUser = document.createElement("div");
                    $sentenceUser.className = "result-user-container";
                    $sentenceUser.textContent = item.user + " - " + convertTime(item.start);
      
                    const $sentenceText = document.createElement("div");
                    $sentenceText.className = "result-text-container";
                    $sentenceText.textContent = item.text;
      
                    $resultText.appendChild($sentenceUser); 
                    $resultText.appendChild($sentenceText); 
                  })
                  return Object.keys(data);
              }).then(keys => {
                console.log($modalAudio);
                //$modalAudio.src = 'http://127.0.0.1:5000/result/'+sessionid.padStart(5,'0')+'/'+UserStorage.getUserData()+'.wav';
                $modalAudio.src = 'http://127.0.0.1:5000/result/'+sessionid.padStart(5,'0')+'/mix.wav';
                keys.forEach(function(item){
                  console.log(item);
                })
              })
          }
        });

        $resultContainer.appendChild($resultBack);
        $resultContainer.appendChild($card_text);
        $resultContainer.appendChild($card_date);
        $resultContainer.appendChild($modalAudio);
        $resultContainer.appendChild($resultText);
        
        $resultContainer.classList.add("animation");
        function passin(e) {
          $resultContainer.removeEventListener("animationend", passin);
          $resultContainer.classList.add("open");
          $resultContainer.classList.remove("animation");
        }
        $resultContainer.addEventListener("animationend", passin);
      }
      $card.parentNode.addEventListener("animationend", passout);
      
        
    }
    
    function editButtonEL(e) {
      e.stopPropagation();

      const $sender = document.createElement("div");
      $sender.className = "sender";

      const $todoInputContainer = this.cardComponent.createToDoContainer();
      $todoInputContainer.querySelector(".todo__input").value = this.text;
      $todoInputContainer
        .querySelector(".todo__input-container")
        .classList.remove("nope");

      const $todoLengthContainer = $todoInputContainer.querySelector(
        ".todo__length-container"
      );
      $todoLengthContainer.textContent = `${this.text.length} / 14`;

      $sender.appendChild($todoInputContainer);

      this.modal.setState({
        title: LangStorage.isEnglish() ? "Edit" : "정보 수정",
        html: {
          data: $sender,
          type: "element",
        },
        onContinue: () => {


          const text = $todoInputContainer.querySelector(".todo__input").value;
          if (text.length < 1 || text.length > 14) {
            $todoInputContainer.classList.add("nope");
            $todoInputContainer.querySelector(
              ".todo__length-container"
            ).style.color = "rgb(255, 129, 107)";
            $todoInputContainer.querySelector(
              ".todo__input"
            ).style.borderColor = "rgb(255, 129, 107)";
            return;
          } else {
            $todoInputContainer.classList.remove("nope");
          }
          this.text = text;
          this.element.querySelector(".card__text").textContent = text;

          const allCards = CardStorage.getAllCardFromTodo();
          const idx = CardStorage.containsTodo(this.id);
          allCards[idx].text = text;
          window.localStorage.setItem(
            "card-key-todo",
            JSON.stringify(allCards)
          );

          this.updatedAt = this.getCurTime.bind(this)();

          let copyCards;
          const filterTag = this.cardComponent.profileComponent.filterTag;
          const cards = this.cardComponent.cards;
          const $allCardContainer = document.querySelector(
            ".all-card-container"
          );

          if (filterTag.length !== 0) {
            copyCards = (cards.pinnedTodo
              ? [cards.pinnedTodo, ...cards.todo]
              : [...cards.todo]
            ).filter((card) => {
              return true;
            });

            if (copyCards.length === 0) {
              const $emptySignSpan = document.createElement("span");
              $emptySignSpan.className = "empty-sign";

              if (LangStorage.isEnglish()) {
                $emptySignSpan.textContent = "No Records";
              } else {
                $emptySignSpan.textContent = "파일 없음";
              }

              $allCardContainer.appendChild($emptySignSpan);
            }

            if (copyCards.indexOf(this) === -1) {
              this.element.remove();
            }
          }
        },
        onLogout: () => {},
        htmlMinHeight: 140,
        hideContinue: false,
      });
    }

    function pinButtonEL_f(e) {
      e.stopPropagation();

      let $target = e.target;

      if (e.target.classList.contains("fas")) {
        $target = $target.parentNode;
      }

      const $card = $target.parentNode.parentNode;
      const allCards = CardStorage.getAllCardFromTodo();

      if ($card.matches(".pinned")) {
        this.cardComponent.cards.todo.unshift(
          this.cardComponent.cards.pinnedTodo
        );
        this.cardComponent.cards.pinnedTodo = null;

        allCards.forEach((cardObj, index) => {
          if (cardObj.id === this.id) {
            allCards[index].pinned = false;
            this.pinned = false;
          }
        });

        $card.classList.remove("pinned");
        $card.querySelector(".pin").classList.remove("off");
        $card.querySelector(".card__pin-text").classList.remove("active");
      } else {
        this.cardComponent.cards.todo = this.cardComponent.cards.todo.filter(
          (card) => card !== this
        );
        if (this.cardComponent.cards.pinnedTodo) {
          this.cardComponent.cards.pinnedTodo.element.classList.remove(
            "pinned"
          );
          this.cardComponent.cards.pinnedTodo.element
            .querySelector(".pin")
            .classList.remove("off");
          this.cardComponent.cards.pinnedTodo.element
            .querySelector(".card__pin-text")
            .classList.remove("active");

          this.cardComponent.cards.todo.unshift(
            this.cardComponent.cards.pinnedTodo
          );
        }
        this.cardComponent.cards.pinnedTodo = this;

        allCards.forEach((cardObj, index) => {
          if (cardObj.id === this.id) {
            allCards[index].pinned = true;
            this.pinned = true;
          } else if (cardObj.pinned) {
            allCards[index].pinned = false;
            this.cardComponent.cards.todo[0].pinned = false;
          }
        });

        $card.classList.add("pinned");
        $card.querySelector(".pin").classList.add("off");
        $card.querySelector(".card__pin-text").classList.add("active");
      }

      window.localStorage.setItem("card-key-todo", JSON.stringify(allCards));
      this.cardComponent.searchCard.bind(this.cardComponent)(null);
    }
    
    const pinButtonEL = pinButtonEL_f.bind(this);

    const $card = document.createElement("div");
    $card.className = this.pinned ? "card pinned" : "card";
    $card.id = this.id;

    const $cardPinText = document.createElement("div");
    $cardPinText.className = "card__pin-text";
    $cardPinText.innerHTML = LangStorage.isEnglish()
      ? '<i class="fas fa-thumbtack"></i> Pinned on top'
      : '<i class="fas fa-thumbtack"></i> 상단에 고정됨';

    const $cardText = document.createElement("div");
    $cardText.className = "card__text";
    if(this.text.length==0){
      if (LangStorage.isEnglish()) {
        $cardText.textContent = "No Title";
      } else {
        $cardText.textContent = "제목 없음";
      }
    }
    else{
      $cardText.textContent = this.text;
    }
    
    const $cardSessionContainer = document.createElement("div");
    $cardSessionContainer.className = "card__session-container";
    $cardSessionContainer.textContent = this.sessionid;

    const $cardDateContainer = document.createElement("div");
    $cardDateContainer.className = "card__date-container";
    
    $cardDateContainer.textContent = this.createdAt.replace('T',' ');
    
    const $cardCountdown = document.createElement("div");
    $cardCountdown.className = "card__countdown";
    if (this.countdown) {
      if (LangStorage.isEnglish()) {
        $cardCountdown.textContent = "Loading";
      } else {
        $cardCountdown.textContent = "잠시만 기다려주세요";
      }
    } else {
      if (LangStorage.isEnglish()) {
        $cardCountdown.textContent = "None";
      } else {
        $cardCountdown.textContent = "녹음 없음";
      }
    }

    const $cardMenuContainer = document.createElement("div");
    $cardMenuContainer.className = "card__menu-container";

    if (!isComplete) {
      const $toggleMenuButton = document.createElement("button");
      $toggleMenuButton.className = "card-menu toggle";
      $toggleMenuButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
      $toggleMenuButton.addEventListener("click", toggleMenuButtonEL_click);
      $toggleMenuButton.addEventListener(
        "focusout",
        toggleMenuButtonEL_focusout
      );

      const $completeButton = document.createElement("button");
      $completeButton.className = "card-menu complete";
      $completeButton.innerHTML = '<i class="fas fa-align-justify"></i>';
      $completeButton.title = "Complete";
      $completeButton.addEventListener(
        "mousedown",
        completeButtonEL.bind(this)
      );

      const $pinButton = document.createElement("button");
      $pinButton.className = "card-menu pin";
      $pinButton.innerHTML = '<i class="fas fa-thumbtack"></i>';
      $pinButton.title = "Toggle Pin";
      $pinButton.addEventListener("mousedown", pinButtonEL);

      const $editButton = document.createElement("button");
      $editButton.className = "card-menu edit";
      $editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      $editButton.title = "Edit";
      $editButton.addEventListener("mousedown", editButtonEL.bind(this));

      const $deleteButton = document.createElement("button");
      $deleteButton.className = "card-menu delete";
      $deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
      $deleteButton.title = "Delete";
      $deleteButton.addEventListener("mousedown", (e) => {
        e.stopPropagation();

        let $target = e.target;

        if (e.target.classList.contains("fas")) {
          $target = $target.parentNode;
        }

        const $card = $target.parentNode.parentNode;
        const id = $card.id;

        CardStorage.removeCardFromTodo(id);

        spliceCardFromToDo($card, this.cardComponent);
        $card.parentNode.removeChild($card);

        const {
          todo,
          complete,
          pinnedTodo,
          pinnedComplete,
        } = this.cardComponent.cards;

        if (this.counter) {
          clearInterval(this.counter);
          this.counter = null;
        }

        const $allCardContainer = document.querySelector(".all-card-container");

        if (document.querySelector(".filter__search-bar").value.length !== 0) {
          this.cardComponent.searchCard.bind(this.cardComponent)(null);
        } else if (
          !this.cardComponent.cards.pinnedTodo &&
          this.cardComponent.cards.todo.length === 0
        ) {
          const $emptySignSpan = document.createElement("span");
          $emptySignSpan.className = "empty-sign";
          if (LangStorage.isEnglish()) {
            $emptySignSpan.textContent = "No Records";
          } else {
            $emptySignSpan.textContent = "파일 없음";
          }

          $allCardContainer.appendChild($emptySignSpan);
        } else {
          let copyCards;
          const filterTag = this.cardComponent.profileComponent.filterTag;
          const cards = this.cardComponent.cards;

          if (filterTag.length !== 0) {
            if (!$allCardContainer.matches(".complete")) {
              copyCards = (cards.pinnedTodo
                ? [cards.pinnedTodo, ...cards.todo]
                : [...cards.todo]
              ).filter((card) => {

                return true;
              });
            } else {
              copyCards = (cards.pinnedComplete
                ? [cards.pinnedComplete, ...cards.complete]
                : [...cards.complete]
              ).filter((card) => {
                return true;
              });
            }

            if (copyCards.length === 0) {
              const $emptySignSpan = document.createElement("span");
              $emptySignSpan.className = "empty-sign";
              if (LangStorage.isEnglish()) {
                $emptySignSpan.textContent = "No Records";
              } else {
                $emptySignSpan.textContent = "파일 없음";
              }

              $allCardContainer.appendChild($emptySignSpan);
            }
          }
        }
      });

      $cardMenuContainer.appendChild($toggleMenuButton);
      $cardMenuContainer.appendChild($completeButton);
      $cardMenuContainer.appendChild($pinButton);
      $cardMenuContainer.appendChild($editButton);
      $cardMenuContainer.appendChild($deleteButton);
    } else {
      $card.classList.add("complete");

      const $toggleMenuButton = document.createElement("button");
      $toggleMenuButton.className = "card-menu toggle";
      $toggleMenuButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
      $toggleMenuButton.addEventListener("click", toggleMenuButtonEL_click);
      $toggleMenuButton.addEventListener(
        "focusout",
        toggleMenuButtonEL_focusout
      );


      const $deleteButton = document.createElement("button");
      $deleteButton.className = "card-menu delete";
      $deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
      $deleteButton.title = "Delete";
      $deleteButton.addEventListener("mousedown", (e) => {
        e.stopPropagation();

        let $target = e.target;

        if (e.target.classList.contains("fas")) {
          $target = $target.parentNode;
        }

        const $card = $target.parentNode.parentNode;
        const id = $card.id;

        CardStorage.removeCardFromComplete(id);

        spliceCardFromComplete($card, this.cardComponent);
        $card.parentNode.removeChild($card);

        const {
          todo,
          complete,
          pinnedTodo,
          pinnedComplete,
        } = this.cardComponent.cards;

        if (this.counter) {
          clearInterval(this.counter);
          this.counter = null;
        }

        const $allCardContainer = document.querySelector(".all-card-container");

        if (document.querySelector(".filter__search-bar").value.length !== 0) {
          this.cardComponent.searchCard.bind(this.cardComponent)(null);
        } else if (
          !this.cardComponent.cards.pinnedComplete &&
          this.cardComponent.cards.complete.length === 0
        ) {
          const $emptySignSpan = document.createElement("span");
          $emptySignSpan.className = "empty-sign";
          if (LangStorage.isEnglish()) {
            $emptySignSpan.textContent = "No Records";
          } else {
            $emptySignSpan.textContent = "파일 없음";
          }

          $allCardContainer.appendChild($emptySignSpan);
        } else {
          let copyCards;
          const filterTag = this.cardComponent.profileComponent.filterTag;
          const cards = this.cardComponent.cards;

          if (filterTag.length !== 0) {
            if (!$allCardContainer.matches(".complete")) {
              copyCards = (cards.pinnedTodo
                ? [cards.pinnedTodo, ...cards.todo]
                : [...cards.todo]
              ).filter((card) => {
                return true;
              });
            } else {
              copyCards = (cards.pinnedComplete
                ? [cards.pinnedComplete, ...cards.complete]
                : [...cards.complete]
              ).filter((card) => {

                return true;
              });
            }

            if (copyCards.length === 0) {
              const $emptySignSpan = document.createElement("span");
              $emptySignSpan.className = "empty-sign";
              if (LangStorage.isEnglish()) {
                $emptySignSpan.textContent = "No Records";
              } else {
                $emptySignSpan.textContent = "파일 없음";
              }

              $allCardContainer.appendChild($emptySignSpan);
            }
          }
        }
      });

      $cardMenuContainer.appendChild($toggleMenuButton);
      $cardMenuContainer.appendChild($deleteButton);
    }

    $card.appendChild($cardCountdown);
    $card.appendChild($cardPinText);
    $card.appendChild($cardText);
    $card.appendChild($cardSessionContainer);
    $card.appendChild($cardDateContainer);
    $card.appendChild($cardMenuContainer);

    return $card;
  }
}
