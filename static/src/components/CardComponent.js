import {
  CardStorage,
  FilterStorage,
  LangStorage,
} from "../utils/CustomStorage.js";
import Card from "./Card.js";

export default class CardComponent {
  constructor({ $target, modal }) {
    this.$target = $target;
    this.modal = modal;
    this.cards = {
      todo: null,
      pinnedTodo: null,
      complete: null,
      pinnedComplete: null,
    };
    this.cards.todo = this.initTodoCards.bind(this)();

    this.activeSection = "todos";
    this.profileComponent = null;
  }

  searchCard(e, isChangeSection = false) {
    let copyCards;
    const $allCardContainer = document.querySelector(".all-card-container");
    const $searchBar = document.querySelector(".filter__search-bar");
    const text = $searchBar.value.toLowerCase();
    const filterTag = this.profileComponent.filterTag;

    if (filterTag.length !== 0) {
      if (!$allCardContainer.matches(".complete")) {
        copyCards = (this.cards.pinnedTodo
          ? [this.cards.pinnedTodo, ...this.cards.todo]
          : [...this.cards.todo]
        ).filter((card) => {
          return true;
        });
      } else {
        copyCards = (this.cards.pinnedComplete
          ? [this.cards.pinnedComplete, ...this.cards.complete]
          : [...this.cards.complete]
        ).filter((card) => {

          return true;
        });
      }
    } else {
      if (!$allCardContainer.matches(".complete")) {
        copyCards = this.cards.pinnedTodo
          ? [this.cards.pinnedTodo, ...this.cards.todo]
          : [...this.cards.todo];
      } else {
        copyCards = this.cards.pinnedComplete
          ? [this.cards.pinnedComplete, ...this.cards.complete]
          : [...this.cards.complete];
      }
    }

    if (text.length === 0) {
      $allCardContainer.innerHTML = "";

      copyCards.forEach((card) => {
        if (!isChangeSection) {
          card.element.classList.add("searched");
        } else {
          card.element.classList.remove("searched");
        }
        $allCardContainer.appendChild(card.element);
      });

      if (copyCards.length === 0) {
        const $emptySignSpan = document.createElement("span");
        $emptySignSpan.className = "empty-sign";
        if (LangStorage.isEnglish()) {
          $emptySignSpan.textContent = "No Records";
        } else {
          $emptySignSpan.textContent = "?????? ??????";
        }
        $allCardContainer.appendChild($emptySignSpan);
      }

      return;
    }

    copyCards = copyCards.filter((card) => {
      const cardText = card.text.toLowerCase();

      for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (cardText.indexOf(c) === -1) {
          return false;
        }
      }

      if (text.length > cardText.length) return false;

      return true;
    });

    $allCardContainer.innerHTML = "";
    if (copyCards.length === 0) {
      const $emptySignSpan = document.createElement("span");
      $emptySignSpan.className = "empty-sign";
      if (LangStorage.isEnglish()) {
        $emptySignSpan.textContent = "No Results";
      } else {
        $emptySignSpan.textContent = "???????????? ??????";
      }
      $allCardContainer.appendChild($emptySignSpan);
    } else {
      copyCards.sort((a, b) => {
        return a.text.indexOf(text[0]) - b.text.indexOf(text[0]);
      });

      copyCards.forEach((card) => {
        if (!isChangeSection) {
          card.element.classList.add("searched");
        } else {
          card.element.classList.remove("searched");
        }
        $allCardContainer.appendChild(card.element);
      });
    }
  }

  setHeightSize() {
    const $cardContainer = document.querySelector(".card-container");
    const brect = $cardContainer.getBoundingClientRect();
    const bodyHeight = document.body.getBoundingClientRect().height;

    $cardContainer.style.height = `${bodyHeight - brect.top - 30}px`;
  }

  initTodoCards() {
    let todo = [];
    const todoCards = CardStorage.getAllCardFromTodo();

    todoCards.forEach((todoCard) => {
      const newCard = new Card({
        countdown: todoCard.countdown,
        text: todoCard.text,
        updatedAt: todoCard.updatedAt,
        createdAt: todoCard.createdAt,
        cardComponent: this,
        salt: todoCard.salt,
        id: todoCard.id,
        modal: this.modal,
        pinned: todoCard.pinned,
        sessionid: todoCard.sessionid,
      });

      if (todoCard.pinned) {
        this.cards.pinnedTodo = newCard;
      } else {
        todo.push(newCard);
      }
    });

    return todo;
  }

  createCardContainer() {
    const $cardContainer = document.createElement("main");
    $cardContainer.className = "card-container loading";
    $cardContainer.style.transform = "translateX(130%)";

    function cardContainerAnimationEND(e) {
      if (e.target.matches(".loading")) {
        $cardContainer.removeEventListener(
          "animationend",
          cardContainerAnimationEND
        );

        $cardContainer.style.transform = "";
        $cardContainer.classList.remove("loading");

        const windowHeight = document.body.getBoundingClientRect().height;
        const $profileContainer = document.querySelector(".profile-container");
        const $profileToggleContainer = document.querySelector(
          ".profile-toggle-container"
        );

        if (windowHeight < 1000) {
          $profileContainer.classList.remove("active");
          $profileToggleContainer.classList.remove("active");
          $profileContainer.classList.add("hidden");
          $profileToggleContainer.classList.add("hidden");
          $profileToggleContainer.innerHTML =
            '<i class="fas fa-chevron-down"></i>';

          $cardContainer.classList.add("hidden");
          if (window.matchMedia("(max-width: 30em)").matches) {
            $cardContainer.style.top = "-80px";
          } else {
            $cardContainer.style.top = "-100px";
          }
          $addCardButton.style.top = "";
          $addCardButton.classList.add("hide");

          $cardContainer.style.height = `${windowHeight - 100}px`;
        }
      }
    }

    $cardContainer.addEventListener("animationend", cardContainerAnimationEND);

    const $addCardButton = document.createElement("button");
    $addCardButton.className = "add-card-button loading";
    $addCardButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512" width="33" height="48"><path d="M176 352c53.02 0 96-42.98 96-96V96c0-53.02-42.98-96-96-96S80 42.98 80 96v160c0 53.02 42.98 96 96 96zm160-160h-16c-8.84 0-16 7.16-16 16v48c0 74.8-64.49 134.82-140.79 127.38C96.71 376.89 48 317.11 48 250.3V208c0-8.84-7.16-16-16-16H16c-8.84 0-16 7.16-16 16v40.16c0 89.64 63.97 169.55 152 181.69V464H96c-8.84 0-16 7.16-16 16v16c0 8.84 7.16 16 16 16h160c8.84 0 16-7.16 16-16v-16c0-8.84-7.16-16-16-16h-56v-33.77C285.71 418.47 352 344.9 352 256v-48c0-8.84-7.16-16-16-16z"/></svg>';

    function addCardAnimationEND() {
      $addCardButton.removeEventListener("animationend", addCardAnimationEND);
      $addCardButton.classList.remove("loading");
    }

    $addCardButton.addEventListener("animationend", addCardAnimationEND);

    $addCardButton.addEventListener("click", () => {
      $addCardButton.blur();
      const $sender = document.createElement("div");
      $sender.className = "sender";

      const $todoInputContainer = this.createToDoContainer();

      $sender.appendChild($todoInputContainer);

      this.modal.setState({
        title: LangStorage.isEnglish() ? "Add Card" : "?????? ??????",
        html: {
          data: $sender,
          type: "element",
        },
        btn: {
          record: true,
          ok: true,
        },
        onContinue: async () => {
          const $audio = $sender.parentElement.parentElement.querySelector(".modal-content__audio");
          
          while($audio.duration === Infinity) {
            await new Promise(r => setTimeout(r, 1000));
            $audio.currentTime = 10000000*Math.random();
          }
          let countdown = $audio.duration;
          const text = $todoInputContainer.querySelector(".todo__input").value;
          
          if (text.length > 14) {
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
          
          const sessionid = document.querySelector(".session-container").textContent;
          console.log(sessionid);

          const newCard = new Card({
            countdown,
            text,
            cardComponent: this,
            modal: this.modal,
            pinned: false,
            sessionid: sessionid,
          });

          this.cards.todo.unshift(newCard);

          CardStorage.addCardToTodo(newCard);

          const $allCardContainer = document.querySelector(
            ".all-card-container"
          );

          if (!$allCardContainer.classList.contains("complete")) {
            $allCardContainer.prepend(newCard.element);
          }

          const $emptySignSpan = $allCardContainer.querySelector(".empty-sign");
          if ($emptySignSpan) {
            $emptySignSpan.remove();
          }

          //$todoSectionButton.click();
          this.searchCard.bind(this)(null, true);
        },
        hideContinue: false,
      });
    });
    /*
    const $todoSectionButton = document.createElement("button");
    $todoSectionButton.className = "section-button__todo active";
    if (LangStorage.isEnglish()) {
      $todoSectionButton.textContent = "Person1";
    } else {
      $todoSectionButton.textContent = "?????????1";
    }
    $todoSectionButton.addEventListener("click", () => {
      if (this.activeSection === "todos") return;

      this.activeSection = "todos";
      $todoSectionButton.classList.add("active");
      $completeSectionButton.classList.remove("active");
      $allCardContainer.classList.remove("complete");

      this.cards.todo.forEach((card) => {
        card.element.classList.remove("searched");
      });
      this.cards.complete.forEach((card) => {
        card.element.classList.remove("searched");
      });

      this.updateCardContainer();
      this.searchCard.bind(this)(null, true);

      if ($searchBar.value.length > 0) {
        $searchBar.focus();
      }
    });

    const $completeSectionButton = document.createElement("button");
    $completeSectionButton.className = "section-button__complete";
    if (LangStorage.isEnglish()) {
      $completeSectionButton.textContent = "Person2";
    } else {
      $completeSectionButton.textContent = "?????????2";

      if (window.matchMedia("(max-width: 30em)").matches) {
        $completeSectionButton.style.paddingRight = "calc(25% - 30px)";
      } else {
        $completeSectionButton.style.paddingRight = "60px";
      }
    }
    
    $completeSectionButton.addEventListener("click", () => {
      if (this.activeSection === "complete") return;

      this.activeSection = "complete";
      $todoSectionButton.classList.remove("active");
      $completeSectionButton.classList.add("active");
      $allCardContainer.classList.add("complete");

      this.cards.todo.forEach((card) => {
        card.element.classList.remove("searched");
      });
      this.cards.complete.forEach((card) => {
        card.element.classList.remove("searched");
      });

      this.updateCardContainer();
      this.searchCard.bind(this)(null, true);

      if ($searchBar.value.length > 0) {
        $searchBar.focus();
      }
    });
    */
    
    const $filterContainer = document.createElement("div");
    $filterContainer.className = "filter-container";

    const $searchContainer = document.createElement("div");
    $searchContainer.className = "filter__search-container";

    const $searchBar = document.createElement("input");
    $searchBar.className = "filter__search-bar";
    $searchBar.type = "text";
    $searchBar.placeholder = LangStorage.isEnglish()
      ? "Search"
      : "??????";
    $searchBar.spellcheck = false;
    $searchBar.addEventListener("focusin", () => {
      $clearButton.classList.add("active");

      if (!$allCardContainer.matches(".complete")) {
        $searchBar.style.borderColor = "#4b61cf";
      } else {
        $searchBar.style.borderColor = "#e26751";
      }
    });
    $searchBar.addEventListener("focusout", () => {
      $clearButton.classList.remove("active");
      $searchBar.style.borderColor = "";
    });
    $searchBar.addEventListener("input", this.searchCard.bind(this));

    const $clearButton = document.createElement("button");
    $clearButton.className = "filter__clear-button";
    $clearButton.innerHTML = '<i class="fas fa-times"></i>';
    $clearButton.addEventListener("click", () => {
      $searchBar.focus();

      if ($searchBar.value.length === 0) return;

      $searchBar.value = "";
      this.searchCard.bind(this)(null);
    });

    const $filterClearButton = document.createElement("button");
    $filterClearButton.className = "filter__filter-clear-button";
    $filterClearButton.innerHTML = LangStorage.isEnglish()
      ? '<i class="fas fa-times"></i><span>Clear All Filters</span>'
      : '<i class="fas fa-times"></i><span>?????? ?????? ??????</span>';
    $filterClearButton.addEventListener("click", () => {
      FilterStorage.removeAllFilter();

      this.profileComponent.filterTag = [];
      this.searchCard.bind(this)(null);

      $filterContainer.classList.remove("filter-active");
      $filterClearButton.classList.remove("active");
    });

    const $resultContainer = document.createElement("div");
    $resultContainer.className = "result-container";
    this.$resultContainer = $resultContainer;

    const $allCardContainer = document.createElement("div");
    $allCardContainer.className = "all-card-container";
    this.$allCardContainer = $allCardContainer;

    $searchContainer.appendChild($searchBar);
    $searchContainer.appendChild($clearButton);
    $filterContainer.appendChild($searchContainer);
    $filterContainer.appendChild($filterClearButton);
    /*
    $cardContainer.appendChild($todoSectionButton);
    $cardContainer.appendChild($completeSectionButton);
    */
    $cardContainer.appendChild($filterContainer);
    $cardContainer.appendChild($allCardContainer);
    $cardContainer.appendChild($resultContainer);
    this.$target.appendChild($cardContainer);
    this.$target.appendChild($addCardButton);

    this.initialRect = $cardContainer.getBoundingClientRect();
    $addCardButton.style.top = `${this.initialRect.top - 40}px`;

    this.setHeightSize();
    window.addEventListener("resize", () => {
      this.setHeightSize();
    });

    this.updateCardContainer();
    this.updateResultContainer();
    this.searchCard.bind(this)(null);

    if (FilterStorage.getAllFilters().length > 0) {
      $filterContainer.classList.add("filter-active");
      $filterClearButton.classList.add("active");
    } else {
      $filterContainer.classList.remove("filter-active");
      $filterClearButton.classList.remove("active");
    }
  }
  
  updateCardContainer() {
    const $allCardContainer = this.$allCardContainer;
    $allCardContainer.innerHTML = "";

    if ($allCardContainer.classList.contains("complete")) {
      let cards = [];

      if (this.cards.pinnedComplete) {
        cards.push(this.cards.pinnedComplete);
      }

      cards = cards.concat(this.cards.complete);

      cards.forEach((card) => {
        $allCardContainer.appendChild(card.element);

        if (card.pinned) {
          card.element.querySelector(".pin").classList.add("off");
          card.element.querySelector(".card__pin-text").classList.add("active");
        }

        if (card.counter) {
          clearInterval(card.counter);
          card.counter = null;
        }

        card.element.querySelector(
          ".card__countdown"
        ).textContent = LangStorage.isEnglish() ? "Complete" : "??????";
      });

      if (cards.length === 0) {
        const $emptySignSpan = document.createElement("span");
        $emptySignSpan.className = "empty-sign";
        if (LangStorage.isEnglish()) {
          $emptySignSpan.textContent = "No Records";
        } else {
          $emptySignSpan.textContent = "?????? ??????";
        }
        $allCardContainer.appendChild($emptySignSpan);
      }
    } else {
      let cards = [];

      if (this.cards.pinnedTodo) {
        cards.push(this.cards.pinnedTodo);
      }

      cards = cards.concat(this.cards.todo);

      cards.forEach((card) => {
        $allCardContainer.appendChild(card.element);

        if (card.pinned) {
          card.element.querySelector(".pin").classList.add("off");
          card.element.querySelector(".card__pin-text").classList.add("active");
        }
      });
      if (cards.length === 0) {
        const $emptySignSpan = document.createElement("span");
        $emptySignSpan.className = "empty-sign";
        if (LangStorage.isEnglish()) {
          $emptySignSpan.textContent = "No Records";
        } else {
          $emptySignSpan.textContent = "?????? ??????";
        }
        $allCardContainer.appendChild($emptySignSpan);
      }
    }
  }

  updateResultContainer() {

    const $resultContainer = this.$resultContainer;
  }

  createToDoContainer() {
    const textLimit = 14;

    const $toDoContainer = document.createElement("div");
    $toDoContainer.className = "todo-container";

    const $inputContainer = document.createElement("div");
    $inputContainer.className = "todo__input-container";

    const $toDoInput = document.createElement("input");
    $toDoInput.className = "todo__input";
    $toDoInput.type = "text";
    $toDoInput.spellcheck = false;
    $toDoInput.placeholder = LangStorage.isEnglish()
      ? "Title"
      : "????????? ??????????????????";
    $toDoInput.addEventListener("focusin", () => {
      $removeButton.classList.add("active");
    });
    $toDoInput.addEventListener("focusout", () => {
      $removeButton.classList.remove("active");
    });
    $toDoInput.addEventListener("input", () => {
      const textSize = $toDoInput.value.length;

      if (textSize > textLimit) {
        $inputContainer.classList.add("nope");
        $lengthContainer.style.color = "rgb(255, 129, 107)";
        $toDoInput.style.borderColor = "rgb(255, 129, 107)";
      } else {
        $inputContainer.classList.remove("nope");
        $lengthContainer.style.color = "";
        $toDoInput.style.borderColor = "";
      }
      $lengthContainer.textContent = `${$toDoInput.value.length} / ${textLimit}`;
    });
    $toDoInput.addEventListener("keyup", (e) => {
      if (e.key === 13) {
        const $submitButton = document.querySelector(".modal-content__ok");
        $submitButton.click();
      }
    });

    const $removeButton = document.createElement("button");
    $removeButton.className = "todo__remove";
    $removeButton.innerHTML = '<i class="fas fa-times"></i>';
    $removeButton.addEventListener("click", () => {
      $inputContainer.classList.add("nope");
      $toDoInput.value = "";
      $lengthContainer.textContent = `0 / ${textLimit}`;
      $lengthContainer.style.color = "";
      $toDoInput.style.borderColor = "";
      $toDoInput.focus();
    });

    const $lengthContainer = document.createElement("div");
    $lengthContainer.className = "todo__length-container";
    $lengthContainer.textContent = `0 / ${textLimit}`;

    $inputContainer.appendChild($toDoInput);
    $inputContainer.appendChild($removeButton);
    $toDoContainer.appendChild($inputContainer);
    $toDoContainer.appendChild($lengthContainer);

    return $toDoContainer;
  }
}
