import {
  TagStorage,
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
    this.cards.complete = this.initCompleteCards.bind(this)();

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
          if (filterTag.length > card.tag.length) return false;

          for (let i = 0; i < filterTag.length; i++) {
            if (card.tag.indexOf(filterTag[i]) === -1) return false;
          }

          return true;
        });
      } else {
        copyCards = (this.cards.pinnedComplete
          ? [this.cards.pinnedComplete, ...this.cards.complete]
          : [...this.cards.complete]
        ).filter((card) => {
          if (filterTag.length > card.tag.length) return false;

          for (let i = 0; i < filterTag.length; i++) {
            if (card.tag.indexOf(filterTag[i]) === -1) return false;
          }

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
          $emptySignSpan.textContent = "파일 없음";
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
        $emptySignSpan.textContent = "검색결과 없음";
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
        tag: todoCard.tag,
        countdown: todoCard.countdown,
        text: todoCard.text,
        updatedAt: todoCard.updatedAt,
        createdAt: todoCard.createdAt,
        cardComponent: this,
        salt: todoCard.salt,
        id: todoCard.id,
        modal: this.modal,
        pinned: todoCard.pinned,
      });

      if (todoCard.pinned) {
        this.cards.pinnedTodo = newCard;
      } else {
        todo.push(newCard);
      }
    });

    return todo;
  }

  initCompleteCards() {
    let complete = [];
    const completeCards = CardStorage.getAllCardFromComplete();

    completeCards.forEach((completeCard) => {
      const $cardElement = document.createElement("div");
      $cardElement.className = completeCard.pinned ? "card pinned" : "card";
      $cardElement.id = completeCard.id;
      $cardElement.innerHTML = completeCard.element;

      const newCard = new Card(
        {
          tag: completeCard.tag,
          countdown: completeCard.countdown,
          text: completeCard.text,
          updatedAt: completeCard.updatedAt,
          createdAt: completeCard.createdAt,
          cardComponent: this,
          salt: completeCard.salt,
          id: completeCard.id,
          modal: this.modal,
          pinned: completeCard.pinned,
        },
        true
      );

      const $countdown = newCard.element.querySelector(".card__countdown");
      $countdown.innerHTML = "Complete";
      $countdown.classList.add("complete");

      if (completeCard.pinned) {
        this.cards.pinnedComplete = newCard;
      } else {
        complete.push(newCard);
      }
    });

    return complete;
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

      const $tagContainer = this.createTagContainer();
      const $todoInputContainer = this.createToDoContainer();

      $sender.appendChild($tagContainer);
      $sender.appendChild($todoInputContainer);

      this.modal.setState({
        title: LangStorage.isEnglish() ? "Add Card" : "녹음 추가",
        html: {
          data: $sender,
          type: "element",
        },
        btn: {
          record: true,
          ok: true,
        },
        onContinue: async () => {
          const $tags = $tagContainer
            .querySelector(".tag-inner-container")
            .querySelectorAll(".tag");
          const tags = [].slice
            .call($tags)
            .map(($tag) =>
              $tag.querySelector(".tag__span").textContent.slice(1)
            );

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

          const newCard = new Card({
            tag: tags,
            countdown,
            text,
            cardComponent: this,
            modal: this.modal,
            pinned: false,
          });

          this.cards.todo.unshift(newCard);

          const allTags = TagStorage.getAllTags();
          tags.forEach((tag) => {
            const idx = TagStorage.contains(tag);
            allTags[idx].cardId.unshift(newCard.id);
          });
          window.localStorage.setItem("tag-key", JSON.stringify(allTags));

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
      $todoSectionButton.textContent = "참가자1";
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
      $completeSectionButton.textContent = "참가자2";

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
      ? "Search id"
      : "검색";
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
      : '<i class="fas fa-times"></i><span>모든 필터 제거</span>';
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
        ).textContent = LangStorage.isEnglish() ? "Complete" : "완료";
      });

      if (cards.length === 0) {
        const $emptySignSpan = document.createElement("span");
        $emptySignSpan.className = "empty-sign";
        if (LangStorage.isEnglish()) {
          $emptySignSpan.textContent = "No Records";
        } else {
          $emptySignSpan.textContent = "파일 없음";
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
          $emptySignSpan.textContent = "파일 없음";
        }
        $allCardContainer.appendChild($emptySignSpan);
      }
    }
  }

  updateResultContainer() {

    const $resultContainer = this.$resultContainer;
  }

  createTagContainer(filtering = false, editing = false) {
    function createTag(tag, r, g, b, a, inSearch = false) {
      const $tag = document.createElement("div");
      $tag.className = "tag";
      $tag.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;

      const $tagSpan = document.createElement("span");
      $tagSpan.className = "tag__span";
      $tagSpan.textContent = "#" + tag;

      $tag.appendChild($tagSpan);

      if (!inSearch) {
        const $tagRemoveButton = document.createElement("button");
        $tagRemoveButton.className = "tag__remove";
        $tagRemoveButton.innerHTML = '<i class="fas fa-times"></i>';
        $tagRemoveButton.addEventListener("click", () => {
          $tagInnerContainer.removeChild($tag);
        });

        $tag.appendChild($tagRemoveButton);
      }

      return $tag;
    }

    function checkRemainTagOnCard(tag) {
      let allTags = $tagInnerContainer.querySelectorAll(".tag");
      allTags = [].slice.call(allTags);

      const result = allTags.filter((item) => item.textContent === tag).length;

      if (result === 0) return false;
      return true;
    }

    function isValidTag(tag) {
      tag = tag.trim().replace(" ", "");

      if (tag.length <= 0) return false;

      const checkKOR = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;

      if (checkKOR.test(tag)) {
        if (tag.length < 1) return false;
        if (tag.length > 6) return false;
      } else {
        if (tag.length < 1) return false;
        if (tag.length > 16) return false;
      }

      return true;
    }

    function addTagOnInnerContainer(tag, filtering) {
      if (checkRemainTagOnCard("#" + tag)) return;

      const tagObj = TagStorage.getTagObj(tag);

      let r, g, b, a;

      if (!tagObj) {
        if (filtering) return;

        r = Math.floor(Math.random() * 256);
        g = Math.floor(Math.random() * 256);
        b = Math.floor(Math.random() * 256);
        a = 0.2;
      } else {
        r = tagObj.r;
        g = tagObj.g;
        b = tagObj.b;
        a = tagObj.a;
      }

      const $tag = createTag(tag, r, g, b, a);
      $tagInnerContainer.insertBefore($tag, $tagInputContainer);
    }

    function updateAllTagContainer() {
      function onItemClick(e) {
        let $item = e.target;

        if (!$item.classList.contains("tag__span")) {
          $item = $item.querySelector(".tag__span");
        }

        if (!$item) return;

        addTagOnInnerContainer($item.textContent.slice(1));
      }

      function onItemClick_Edit(e) {
        let $item = e.target;

        if (!$item.classList.contains("tag__span")) {
          $item = $item.querySelector(".tag__span");
        }

        if (!$item) return;

        const tag = $item.textContent.slice(1);
        const { r, g, b, a } = TagStorage.getTagObj(tag);

        const $tag = createTag(tag, r, g, b, a, true);
        document.querySelector(".edit__cover").classList.add("hidden");

        const $thumbContainer = document.querySelector(
          ".edit__thumb-container"
        );
        $thumbContainer.innerHTML = "";
        $thumbContainer.appendChild($tag);

        const $inputR = document.querySelector(".edit-input.r");
        $inputR.value = r;

        const $inputG = document.querySelector(".edit-input.g");
        $inputG.value = g;

        const $inputB = document.querySelector(".edit-input.b");
        $inputB.value = b;

        const $inputA = document.querySelector(".edit-input.a");
        $inputA.value = a * 100;
      }

      $allTagContainer.innerHTML = "";

      const allTags = TagStorage.getAllTags();

      $allTagContainer.classList.remove("empty");
      if (allTags.length === 0) {
        $allTagContainer.classList.add("empty");
        if (LangStorage.isEnglish()) {
          $allTagContainer.textContent = "No Tags";
        } else {
          $allTagContainer.textContent = "태그 없음";
        }
      } else {
        allTags.forEach((tagObj) => {
          const { text, r, g, b, a } = tagObj;

          const $tagItem = document.createElement("div");
          $tagItem.className = "all-tag__item";

          const $tag = createTag(text, r, g, b, a, true);
          $tagItem.appendChild($tag);

          $allTagContainer.appendChild($tagItem);
        });

        // Remove EventListener
        const old_element = $allTagContainer;
        const new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        $allTagContainer = new_element;

        if (!editing) {
          $allTagContainer.addEventListener("mousedown", onItemClick);
        } else {
          $allTagContainer.addEventListener("mousedown", onItemClick_Edit);
        }
      }
    }

    const $tagContainer = document.createElement("div");
    $tagContainer.className = "tag-container";

    const $tagInnerContainer = document.createElement("div");
    $tagInnerContainer.className = "tag-inner-container";
    $tagInnerContainer.style.cursor = "pointer";
    $tagInnerContainer.addEventListener("mouseenter", () => {
      if ($allTagContainer.classList.contains("hidden")) {
        $tagInnerContainer.style.boxShadow = "0 0 20px rgba(0, 0, 0, 0.3)";
      }
    });
    $tagInnerContainer.addEventListener("mouseleave", () => {
      $tagInnerContainer.style.boxShadow = "none";
    });

    let $allTagContainer = document.createElement("div");
    $allTagContainer.className = "all-tag-container hidden";

    const $tagInputContainer = document.createElement("div");
    $tagInputContainer.className = "tag__input-container";

    const $tagInput = document.createElement("input");
    $tagInput.className = "tag__input";
    $tagInput.type = "text";
    $tagInput.placeholder = LangStorage.isEnglish()
      ? "Add Tag..."
      : "태그 추가...";
    $tagInput.spellcheck = false;
    $tagInput.style.cursor = "pointer";
    $tagInput.addEventListener("keyup", (e) => {
      let tag = $tagInput.value;

      if (e.keyCode === 13) {
        tag = tag.trim().replace(" ", "");

        if (checkRemainTagOnCard(tag) || !isValidTag(tag)) {
          $tagInput.value = "";
          return;
        }

        if (TagStorage.contains(tag) === -1 && !filtering) {
          let newObj = {
            text: tag,
            r: Math.floor(Math.random() * 256),
            g: Math.floor(Math.random() * 256),
            b: Math.floor(Math.random() * 256),
            a: 0.2,
            cardId: [],
          };
          TagStorage.appendTag(newObj);
        }

        if (!editing) {
          addTagOnInnerContainer(tag, filtering);
        }

        $tagInput.value = "";

        updateAllTagContainer();
      }
    });

    $tagInput.addEventListener("keydown", (e) => {
      let tag = $tagInput.value;

      if (e.keyCode === 8 && tag.length === 0) {
        let allTags = $tagInnerContainer.querySelectorAll(".tag");
        allTags = [].slice.call(allTags);

        if (allTags.length > 0) {
          const $recentTag = allTags.pop();
          $tagInnerContainer.removeChild($recentTag);
        }

        updateAllTagContainer();
      }
    });

    $tagInput.addEventListener("focusin", () => {
      $tagContainer.style.boxShadow = "0 0 30px rgba(0, 0, 0, 0.3)";
      $tagInnerContainer.style.borderRadius = "0";
      $tagInnerContainer.style.borderTopLeftRadius = "10px";
      $tagInnerContainer.style.borderTopRightRadius = "10px";
      $allTagContainer.style.borderTop = "1px solid rgba(0, 0, 0, 0.3)";
      $allTagContainer.classList.remove("hidden");
      $tagInnerContainer.style.cursor = "text";
      $tagInput.style.cursor = "text";

      updateAllTagContainer();
    });

    $tagInput.addEventListener("focusout", (e) => {
      $tagContainer.style.boxShadow = "none";
      $tagInnerContainer.style.borderRadius = "10px";
      $allTagContainer.classList.add("hidden");
      $tagInput.style.cursor = "pointer";
      $tagInnerContainer.style.cursor = "pointer";
    });

    $tagInputContainer.appendChild($tagInput);
    $tagInnerContainer.appendChild($tagInputContainer);
    $tagContainer.appendChild($tagInnerContainer);
    $tagContainer.appendChild($allTagContainer);

    return $tagContainer;
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
      ? "Leave a note"
      : "메모를 작성해주세요!";
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
      if (e.keyCode === 13) {
        const $submitButton = document.querySelector(".modal-content__record");
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
