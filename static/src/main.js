import App from "./App.js";
import { applyAllFonts } from "./utils/Fonts.js";
import { LangStorage } from "./utils/CustomStorage.js";

window.onload = () => {
  if (!LangStorage.valueSeted()) {
    LangStorage.setLanguage("KOR");
  }

  applyAllFonts();
  new App(document.getElementById("app"));
};