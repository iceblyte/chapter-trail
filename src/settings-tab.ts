/**
 * Plugin settings tab (Obsidian native Setting API, prototype 06).
 * Four settings + the remove-all wizard entry; fully i18n'd and re-rendered
 * when Language changes.
 */
import { PluginSettingTab, Setting } from "obsidian";
import type { Lang } from "./i18n/index";
import type { I18nService } from "./i18n/runtime";
import type { ChapterTrailSettings } from "./settings";

export interface SettingsHooks {
  /** validate + persist a new index file name; returns the effective name */
  onIndexFileNameChange(name: string): Promise<string>;
  /** persist the index date toggles; marks affected domains outdated */
  onIndexDatesChange(): Promise<void>;
  /** persist the dissolve behavior toggle */
  onDissolveBehaviorChange(): Promise<void>;
  /** persist the picker exclusion list; returns the normalized string */
  onPickerExcludeChange(value: string): Promise<string>;
  /** validate + persist a date-source setting; returns the effective value */
  onDateSourceChange(
    kind: "updatedProperty" | "createdProperty" | "dateFormat",
    value: string,
  ): Promise<string>;
  /** persist the auto-rebuild switch */
  onAutoRebuildChange(enabled: boolean): Promise<void>;
  /** user flipped the injection gate; returns the final gate state */
  onInjectionToggle(next: boolean): Promise<boolean>;
  /** how many notes currently carry nav markers */
  countInjectedNotes(): Promise<number>;
  /** strip every nav marker in the vault (asked after gate-off) */
  stripAllMarkers(): Promise<void>;
  onLanguageChange(lang: Lang): Promise<void>;
  openRemoveAllWizard(): void;
}

export interface SettingsTabHost {
  app: import("obsidian").App;
  settings: ChapterTrailSettings;
}

/** the author's afdian sponsorship page */
const afdianUrl = "https://afdian.com/a/iceblyte?utm_source=copylink&utm_medium=link";

export class ChapterTrailSettingTab extends PluginSettingTab {
  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly host: SettingsTabHost,
    private readonly i18n: I18nService,
    private readonly hooks: SettingsHooks,
  ) {
    super(host.app, host as never);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);

    new Setting(containerEl).setName("Chapter Trail").setHeading();
    containerEl.createEl("div", { cls: "ct-setting-tab-sub" }).innerHTML = t(
      "Folder ordering, index pages and series navigation · v1.0.0 · MIT · no telemetry",
    );

    /* Index file name */
    new Setting(containerEl)
      .setName(t("Index file name"))
      .setDesc(
        t(
          "Used when creating new index pages. Recognition is by the <code>is-index</code> marker, not the file name — existing pages are never renamed. Preset suggestion: <code>index</code>. Changing this marks affected domains “Index outdated”.",
        ),
      )
      .addText((text) => {
        text.setValue(this.host.settings.indexFileName).onChange(async (value) => {
          const effective = await this.hooks.onIndexFileNameChange(value);
          text.setValue(effective);
        });
      });

    /* Index dates: two independent toggles (default: created on, updated off) */
    new Setting(containerEl)
      .setName(t("Show created date on index pages"))
      .setDesc(
        t(
          "Default on. Index entries show each note’s created property (name configurable below). Tip: the community plugin <b>Update modified date</b> can keep these properties current automatically — no manual maintenance needed.",
        ),
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.indexShowCreated);
        toggle.onChange(async (next) => {
          this.host.settings.indexShowCreated = next;
          await this.hooks.onIndexDatesChange();
        });
      });

    new Setting(containerEl)
      .setName(t("Show updated date on index pages"))
      .setDesc(
        t(
          "Default off. Turn on to also show the updated property; with both on, entries render as “created → updated”.",
        ),
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.indexShowUpdated);
        toggle.onChange(async (next) => {
          this.host.settings.indexShowUpdated = next;
          await this.hooks.onIndexDatesChange();
        });
      });

    /* Date source: property names + display format (bug 5/6/8) —
     * mirrors the "Update modified date" plugin's settings */
    new Setting(containerEl)
      .setName(t("Modified date property"))
      .setDesc(
        t(
          "The name of the YAML/frontmatter property to read as the updated date — same default as the “Update modified date” plugin.",
        ),
      )
      .addText((text) => {
        text.setValue(this.host.settings.updatedProperty).onChange(async (value) => {
          const effective = await this.hooks.onDateSourceChange("updatedProperty", value);
          text.setValue(effective);
        });
      });

    new Setting(containerEl)
      .setName(t("Created date property (optional)"))
      .setDesc(
        t(
          "Optional. The property read as the created date; leave empty to hide created dates everywhere.",
        ),
      )
      .addText((text) => {
        text.setValue(this.host.settings.createdProperty).onChange(async (value) => {
          const effective = await this.hooks.onDateSourceChange("createdProperty", value);
          text.setValue(effective);
        });
      });

    new Setting(containerEl)
      .setName(t("Date format"))
      .setDesc(
        t(
          "Momentjs-style tokens: <code>YYYY</code> <code>YY</code> <code>MM</code> <code>DD</code> <code>HH</code> <code>mm</code> <code>ss</code>. Values without a time part never show one. Blank = <code>YYYY-MM-DD HH:mm</code>.",
        ),
      )
      .addText((text) => {
        text.setValue(this.host.settings.dateFormat).onChange(async (value) => {
          const effective = await this.hooks.onDateSourceChange("dateFormat", value);
          text.setValue(effective);
        });
      });

    /* Auto-rebuild index after order writes (PRD §2.5, default off) */
    new Setting(containerEl)
      .setName(t("Auto-rebuild index after order changes"))
      .setDesc(
        t(
          "When on, an order write in a domain (drag landing, reindex, first-run assignment, tight-gap auto normalize) automatically rebuilds that domain’s index — only the affected domain, never the whole vault. When off, the domain is flagged “Index outdated” for a manual rebuild.",
        ),
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.autoRebuildIndex);
        toggle.onChange(async (next) => {
          this.host.settings.autoRebuildIndex = next;
          await this.hooks.onAutoRebuildChange(next);
        });
      });

    /* Injection gate — the single gate of every nav write */
    const inject = new Setting(containerEl).setName(t("Write prev / next navigation"));
    inject.setDesc(
      t(
        "<b>Off: nothing is ever written into your notes</b> — the jump commands (previous / next / open index) still work. Turning on asks for confirmation, then writes collapsible callouts wrapped in removable markers.",
      ),
    );
    const extra = inject.descEl.createEl("div", { cls: "ct-set-extra" });
    const extraLabel = extra.createSpan();
    const clearBtn = extra.createEl("button", { cls: "mod-warning", text: t("Clear markers") });
    extra
      .createEl("button", {
        text: t("Keep them"),
      })
      .addEventListener("click", () => {
        extra.removeClass("is-open");
      });
    clearBtn.addEventListener("click", async () => {
      extra.removeClass("is-open");
      await this.hooks.stripAllMarkers();
    });
    inject.addToggle((toggle) => {
      toggle.setValue(this.host.settings.injectNavEnabled);
      toggle.onChange(async (next) => {
        const finalState = await this.hooks.onInjectionToggle(next);
        toggle.setValue(finalState);
        if (!finalState && !next) {
          // gate just closed — ask whether to strip existing markers
          const count = await this.hooks.countInjectedNotes();
          extraLabel.innerHTML = t("Remove all injected markers from {n} notes?", { n: count });
          extra.addClass("is-open");
        }
      });
    });

    /* Language */
    new Setting(containerEl)
      .setName(t("Language"))
      .setDesc(
        t(
          "UI language for the panel, commands and dialogs. Defaults to <b>English</b>; switching re-labels the panel, commands and dialogs immediately. All plugin copy goes through an i18n dictionary.",
        ),
      )
      .addDropdown((drop) => {
        drop.addOption("en", t("English"));
        drop.addOption("zh", t("中文"));
        drop.setValue(this.host.settings.language);
        drop.onChange(async (value) => {
          await this.hooks.onLanguageChange(value === "zh" ? "zh" : "en");
        });
      });

    /* Dissolve behavior: what happens to the index page */
    new Setting(containerEl)
      .setName(t("Delete the index page when a domain dissolves"))
      .setDesc(
        t(
          "Default on: dissolving a domain moves {indexFile}.md to the system trash. Turn off to keep the page as a normal note — the plugin markers and the is-index/mode keys are removed and the rendered list stays as static text.",
          { indexFile: this.host.settings.indexFileName },
        ),
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.deleteIndexOnDissolve);
        toggle.onChange(async (next) => {
          this.host.settings.deleteIndexOnDissolve = next;
          await this.hooks.onDissolveBehaviorChange();
        });
      });

    /* Picker exclusions (round 21) */
    new Setting(containerEl)
      .setName(t("Excluded folders in the picker"))
      .setDesc(
        t(
          "Folder names hidden from the start-managing tree, matched by name at any depth (case-insensitive, comma-separated). Defaults: <code>assets</code>, <code>attachment</code>, <code>attachments</code>.",
        ),
      )
      .addText((text) => {
        text
          .setValue(this.host.settings.pickerExcludeFolders.join(", "))
          .onChange(async (value) => {
            const effective = await this.hooks.onPickerExcludeChange(value);
            text.setValue(effective);
          });
      });

    /* Sponsor (afdian) */
    new Setting(containerEl)
      .setName(t("Support the author"))
      .setDesc(
        t(
          "If Chapter Trail is useful to you, a sponsorship on 爱发电 (afdian) keeps development going. Thank you!",
        ),
      )
      .addButton((button) => {
        button.setButtonText(t("❤ Sponsor on afdian")).onClick(() => {
          window.open(afdianUrl, "_blank");
        });
      });

    /* Remove all */
    new Setting(containerEl)
      .setName(t("Remove all Chapter Trail data"))
      .setDesc(
        t(
          "Full exit path: strip injected navigation → delete index pages (per-domain confirm) → clear order fields (per-domain confirm). Everything outside the confirmed scope is untouched.",
        ),
      )
      .addButton((button) => {
        button.buttonEl.addClass("mod-warning");
        button.setButtonText(t("Open wizard…"));
        button.onClick(() => this.hooks.openRemoveAllWizard());
      });
  }

  /** re-render when the language flips */
  attachLangListener(): void {
    this.unsubscribe = this.i18n.subscribe(() => this.display());
  }

  detachLangListener(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
