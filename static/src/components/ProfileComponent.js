import {
  FilterStorage,
  UserStorage,
  TagStorage,
  LangStorage,
  CardStorage,
} from "../utils/CustomStorage.js";

export default class ProfileComponent {
  constructor({ $target, modal, cardComponent }) {
    this.$target = $target;
    this.modal = modal;
    this.user = UserStorage.isUserSigned ? UserStorage.getUserData() : null;
    this.cardComponent = cardComponent;
    this.filterTag = null;
  }

  renderProfile() {
    const profileContainer = document.createElement("header");
    profileContainer.className = "profile-container";
    profileContainer.addEventListener("animationend", () => {
      profileContainer.classList.add("active");
    });

    const sessionContainer = document.createElement("div");
    sessionContainer.className = "session-container";

    const $profileToggleContainer = document.createElement("div");
    $profileToggleContainer.className = "profile-toggle-container";
    profileContainer.addEventListener("animationend", () => {
      $profileToggleContainer.classList.add("active");
    });

    $profileToggleContainer.innerHTML = '<i class="fas fa-chevron-up"></i>';
    $profileToggleContainer.addEventListener("click", () => {
      const $cardContainer = document.querySelector(".card-container");
      const $addCardButton = document.querySelector(".add-card-button");

      if ($profileToggleContainer.matches(".active")) {
        profileContainer.classList.remove("active");
        $profileToggleContainer.classList.remove("active");
        profileContainer.classList.add("hidden");
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

        const bodyHeight = document.body.getBoundingClientRect().height;
        $cardContainer.style.height = `${bodyHeight - 100}px`;
      } else {
        profileContainer.classList.remove("hidden");
        $profileToggleContainer.classList.remove("hidden");
        $profileToggleContainer.innerHTML = '<i class="fas fa-chevron-up"></i>';
        $cardContainer.classList.remove("hidden");
        $cardContainer.style.top = "";
        $addCardButton.style.top = `${
          this.cardComponent.initialRect.top - 40
        }px`;
        $addCardButton.classList.remove("hide");

        const bodyHeight = document.body.getBoundingClientRect().height;

        if (window.matchMedia("(max-width: 30em)").matches) {
          $cardContainer.style.height = `${bodyHeight - 160}px`;
        } else {
          $cardContainer.style.height = `${bodyHeight - 200}px`;
        }
      }
      
    });

    const profileText = document.createElement("section");
    profileText.className = "profile-text";

    const profileName = document.createElement("span");
    profileName.className = "profile-text__name";
    profileName.textContent = this.user;

    profileText.appendChild(profileName);
    
    this.$buttonContainer = this.createButtonContainer();
    this.$hashButtonContainer = this.createHashButtonContainer();

    profileContainer.appendChild(sessionContainer);
    profileContainer.appendChild(this.$buttonContainer);
    profileContainer.appendChild(this.$hashButtonContainer);
    profileContainer.appendChild(profileText);
    this.$target.appendChild(profileContainer);
    this.$target.appendChild($profileToggleContainer);

    const {
      todo,
      complete,
      pinnedComplete,
      pinnedTodo,
    } = this.cardComponent.cards;
  }

  createButtonContainer() {
    const $buttonContainer = document.createElement("section");
    $buttonContainer.className = "profile-button-container";

    const $logoutBtn = document.createElement("button");
    $logoutBtn.className = "profile-button logout";
    $logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
    $logoutBtn.title = "Sign out";
    $logoutBtn.addEventListener("click", () => {
      this.modal.setState({
        title: LangStorage.isEnglish() ? "Sign out" : "로그아웃",
        text: LangStorage.isEnglish()
          ? ["Your all data will remove.", "Continue sign out?"]
          : ["모든 데이터가 삭제됩니다.", "로그아웃 하시겠습니까?"],
        btn: {
          record: false,
          ok: true,
        },
        onLogout: () => {
          UserStorage.removeUserData();
        },
        modalMinHeight: 400,
        hideContinue: false,
      });
    });

    $buttonContainer.appendChild($logoutBtn);

    return $buttonContainer;
  }

  createHashButtonContainer() {
    function createTag(
      tag,
      r,
      g,
      b,
      inThumb = false,
      $tagInnerContainer = null
    ) {
      const $tag = document.createElement("div");
      $tag.className = "tag";
      $tag.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.2)`;

      const $tagSpan = document.createElement("span");
      $tagSpan.className = "tag__span";
      $tagSpan.textContent = "#" + tag;

      $tag.appendChild($tagSpan);

      if (!inThumb) {
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

    const $hashButtonContainer = document.createElement("section");
    $hashButtonContainer.className = "hash-button-container";

    const $langBtn = document.createElement("button");
    $langBtn.className = "hash-button language";
    $langBtn.innerHTML = '<i class="fas fa-globe-americas"></i>';
    $langBtn.title = "Toggle Language";
    $langBtn.addEventListener("click", () => {
      LangStorage.toggleLanguage();
      location.reload();
    });

    $hashButtonContainer.appendChild($langBtn);
    return $hashButtonContainer;
  }

  setState(nextData) {
    this.$target.classList.remove("hidden");
    this.user = nextData;
    this.filterTag = FilterStorage.getAllFilters();
    this.renderProfile();
  }
}
