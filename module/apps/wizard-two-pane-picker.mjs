/**
 * Modal two-pane picker (list + HTML detail + action row) for character wizard steps.
 */
export class WizardTwoPanePicker extends Application {
  constructor(options = {}) {
    super(options);
    this.selectedId = options.initialId ?? null;
    this._getContext = options.getContext;
    this._onAction = options.onAction;
    this._extraActivate = options.extraActivate;
    this.parentWizard = options.parentWizard;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wizard-two-pane-picker",
      classes: ["cts-dnd-35", "wizard-picker-popout"],
      template: "systems/CTS-DND-35/templates/apps/wizard-two-pane-picker.hbs",
      width: 920,
      height: 640,
      resizable: true,
      popOut: true,
      minimizable: false
    });
  }

  async getData() {
    const base = await super.getData();
    if (typeof this._getContext !== "function") return base;
    const ctx = await this._getContext(this.selectedId);
    return foundry.utils.mergeObject(base, ctx);
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (this.parentWizard && typeof this._extraActivate === "function") {
      this._extraActivate(html, this);
    }
    html.find("input[data-picker-sync], select[data-picker-sync]").on("input change", (ev) => {
      const field = ev.currentTarget.dataset.pickerSync;
      const w = this.parentWizard;
      if (!w || !field) return;
      if (field === "classSearch") w.state.classSearch = ev.currentTarget.value;
      else if (field === "featSearch") w.state.featSearch = ev.currentTarget.value;
      else if (field === "featTypeFilter") w.state.featTypeFilter = ev.currentTarget.value;
      else if (field === "spellSearch") w.state.spellSearch = ev.currentTarget.value;
      w.render();
      this.render();
    });
    html.find("button[data-picker-sync]").click((ev) => {
      const field = ev.currentTarget.dataset.pickerSync;
      const w = this.parentWizard;
      if (!w || field !== "toggleUnavailable") return;
      w.state.showUnavailable = !w.state.showUnavailable;
      w.render();
      this.render();
    });
    html.find(".wizard-picker-item").click((ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.id;
      if (!id || ev.currentTarget.disabled) return;
      this.selectedId = id;
      this.render();
    });
    html.find(".picker-action").click(async (ev) => {
      ev.preventDefault();
      const action = ev.currentTarget.dataset.action;
      if (!action || ev.currentTarget.disabled) return;
      if (typeof this._onAction === "function") await this._onAction(action, this.selectedId, this);
    });
  }
}
