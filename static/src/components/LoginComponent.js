import { UserStorage, LangStorage } from "../utils/CustomStorage.js";

export default class LoginComponent {
  constructor({ $target, profileComponent, cardComponent }) {
    this.$target = $target;
    this.isLoading = false;
    this.profileComponent = profileComponent;
    this.cardComponent = cardComponent;

    if (!UserStorage.isUserSigned()) {
      this.$target.classList.add("login");
      this.$loginContainer = document.createElement("div");
      this.$loginContainer.className = "login-container";
      this.$target.appendChild(this.$loginContainer);

      this.renderLogin.bind(this)({
        settingUser: true,
        loginSpanText: LangStorage.isEnglish()
          ? "Hello, there!"
          : "안녕하세요!",
        loginInputPlaceHolder: LangStorage.isEnglish()
          ? "What's your name?"
          : "이름을 알려주세요!",
      });
    } else {
      this.user = UserStorage.getUserData();

      this.cardComponent.profileComponent = this.profileComponent;
      this.profileComponent.setState(this.user);
      this.cardComponent.createCardContainer();
    }
  }

  renderLogin({ settingUser, loginSpanText, loginInputPlaceHolder }) {
    let loginSpan = this.$loginContainer.querySelector(".login__span");
    if (!loginSpan) {
      loginSpan = document.createElement("span");
      loginSpan.className = "login__span";
      this.$loginContainer.appendChild(loginSpan);
    }

    if (settingUser) {
      loginSpan.textContent = loginSpanText;

      let $langBtn = this.$loginContainer.querySelector(".login__lang-button");
      if (!$langBtn) {
        $langBtn = document.createElement("button");
        $langBtn.className = "login__lang-button";
        $langBtn.innerHTML = '<i class="fas fa-globe-americas"></i>';
        $langBtn.title = "Toggle Language";
        $langBtn.addEventListener("click", () => {
          if (!this.isLoading) {
            LangStorage.toggleLanguage();
            location.reload();
          }
        });
        this.$loginContainer.appendChild($langBtn);
      }

      let loginInput = this.$loginContainer.querySelector(".login__input");
      if (!loginInput) {
        loginInput = document.createElement("input");
        loginInput.className = "login__input";
        loginInput.type = "text";
        loginInput.autofocus = true;
        loginInput.autocomplete = "off";
        loginInput.spellcheck = false;
        loginInput.addEventListener("input", () => {
          this.toggleLoginBtn(this.isValidUser(loginInput.value));
        });

        loginInput.addEventListener("keyup", (e) => {
          if (e.key === 13 && !this.isLoading) {
            this.renderCheckUser();
          }
        });
        this.$loginContainer.appendChild(loginInput);
      }
      loginInput.placeholder = loginInputPlaceHolder;

      let loginBtn = this.$loginContainer.querySelector(".login__button");
      if (!loginBtn) {
        loginBtn = document.createElement("button");
        loginBtn.className = "login__button";
        loginBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
        loginBtn.addEventListener("click", () => this.renderCheckUser());
        this.$loginContainer.appendChild(loginBtn);
      }
    } else {
      loginSpan.innerHTML = "";
      const [username, text] = loginSpanText.split("|");
      const p = document.createElement("p");
      p.textContent = username;

      const span = document.createElement("span");
      span.textContent = text;

      loginSpan.appendChild(p);
      loginSpan.appendChild(span);

      const btnContainer = document.createElement("div");
      btnContainer.className = "user-button-container";

      const okBtn = document.createElement("button");
      okBtn.className = "user-button";
      okBtn.classList.add("ok");
      okBtn.addEventListener("click", () => {
        if (!this.isLoading) {
          this.user = username;
          UserStorage.setUserData(username);
          this.setState({}, true);
        }
      });

      const noBtn = document.createElement("button");
      noBtn.className = "user-button";
      noBtn.classList.add("no");
      noBtn.addEventListener("click", () => {
        if (!this.isLoading) {
          this.setState({
            settingUser: true,
            loginSpanText: LangStorage.isEnglish()
              ? "Hello, there!"
              : "안녕하세요!",
            loginInputPlaceHolder: LangStorage.isEnglish()
              ? "What's your name?"
              : "이름을 알려주세요!",
          });
        }
      });

      okBtn.innerHTML = '<i class="fas fa-check"></i>';
      noBtn.innerHTML = '<i class="fas fa-times"></i>';

      btnContainer.appendChild(okBtn);
      btnContainer.appendChild(noBtn);
      this.$loginContainer.appendChild(btnContainer);
    }
  }

  toggleLoginBtn(valid) {
    const buttton = this.$target.querySelector(".login__button");

    if (valid) {
      buttton.classList.add("valid");
    } else {
      buttton.classList.remove("valid");
    }
  }

  renderCheckUser() {
    const user = UserStorage.convertUser(
      this.$target.querySelector(".login__input").value
    );

    if (this.isValidUser(user)) {
      this.user = user;
      this.setState({
        settingUser: false,
        loginSpanText: LangStorage.isEnglish()
          ? `${user}|Is it your name?`
          : `${user}|입력한 이름을 확인해주세요.`,
        loginInputPlaceHolder: null,
      });
    }
  }

  isValidUser(user) {
    if (user.length <= 0) return false;

    user = UserStorage.convertUser(user);
    const checkKOR = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;

    if (checkKOR.test(user)) {
      if (user.length < 2) return false;
      if (user.length > 6) return false;
    } else {
      if (user.length < 2) return false;
      if (user.length > 16) return false;
    }

    return true;
  }

  setState(nextData, isEnd = false) {
    this.isLoading = true;

    const ls = this.$loginContainer.querySelector(".login__span");
    const llb = this.$loginContainer.querySelector(".login__lang-button");
    const li = this.$loginContainer.querySelector(".login__input");
    const lb = this.$loginContainer.querySelector(".login__button");
    const ubc = this.$loginContainer.querySelector(".user-button-container");

    if (ls) ls.classList.add("loading");
    if (llb) llb.classList.add("loading");
    if (li) li.classList.add("loading");
    if (lb) lb.classList.add("loading");
    if (ubc) {
      ubc.querySelector(".ok").classList.add("loading");
      ubc.querySelector(".no").classList.add("loading");
    }

    if (isEnd) {
      this.$loginContainer.classList.add("end");
      setTimeout(() => {
        this.isLoading = false;
        this.$target.classList.remove("login");
        this.$target.removeChild(this.$loginContainer);

        this.cardComponent.profileComponent = this.profileComponent;
        this.profileComponent.setState(this.user);
        this.cardComponent.createCardContainer();
      }, 1000);
      return;
    }

    setTimeout(() => {
      this.isLoading = false;

      if (ls) ls.classList.remove("loading");
      if (llb) this.$loginContainer.removeChild(llb);
      if (li) this.$loginContainer.removeChild(li);
      if (lb) this.$loginContainer.removeChild(lb);
      if (ubc) this.$loginContainer.removeChild(ubc);

      this.renderLogin(nextData);
    }, 500);
  }
}
