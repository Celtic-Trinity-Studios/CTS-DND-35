/**
 * Settings menu wrapper so help appears under Configure Settings -> CTS DND 3.5.
 */
export class CTSDND35HelpMenuApp extends foundry.appv1.api.FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "cts-dnd-35-help-menu",
      title: game.i18n.localize("CTSDND35.Help.Title"),
      classes: ["cts-dnd-35", "help-app"],
      template: "systems/CTS-DND-35/templates/help-app.hbs",
      width: 680,
      height: 760,
      submitOnChange: false,
      closeOnSubmit: false,
      resizable: true,
    });
  }

  async _updateObject(_event, _formData) {
    return;
  }
}
