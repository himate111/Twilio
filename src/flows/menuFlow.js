const formatter = require('../utils/formatter');
const { MENU_TRIGGERS, CANCEL_TRIGGERS } = require('../utils/constants');

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

function isMenuTrigger(text) {
  return MENU_TRIGGERS.has(normalize(text));
}

function isCancelTrigger(text) {
  return CANCEL_TRIGGERS.has(normalize(text));
}

function getMenuChoice(text) {

  const normalized =
    normalize(text);

  if (
    [
      '1','2','3','4','5',
      '6','7','8','9','10'
    ].includes(normalized)
  ) {
    return normalized;
  }

  return null;
}

function renderMainMenu() {
  return formatter.mainMenu();
}

function renderHelp() {
  return formatter.help();
}

module.exports = {
  isMenuTrigger,
  isCancelTrigger,
  getMenuChoice,
  renderMainMenu,
  renderHelp
};
