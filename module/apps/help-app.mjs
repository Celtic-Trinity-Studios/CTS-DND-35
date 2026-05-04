/**
 * CTS DND 3.5 — In-game help (system mechanics for GMs and players).
 */

export class CTSDND35HelpApp extends Application {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "cts-dnd-35-help",
      classes: ["cts-dnd-35", "help-app"],
      template: "systems/CTS-DND-35/templates/help-app.hbs",
      width: 680,
      height: 760,
      resizable: true,
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("CTSDND35.Help.Title");
  }

  /** @type {CTSDND35HelpApp | null} */
  static _instance = null;

  static open() {
    if (!this._instance) this._instance = new CTSDND35HelpApp();
    this._instance.render(true);
    return this._instance;
  }
}
