/**
 * Plugin entry point — assembly only (DESIGN.md §2.1). Owns settings,
 * the i18n service, port adapters, the settings tab and command
 * registration. Domain logic lives in src/core and later service modules.
 */
import { Plugin } from "obsidian";
import {
  ObsidianConfirmPort,
  ObsidianNotifierPort,
  ObsidianVaultAdapter,
  SystemClockPort,
} from "./adapter/obsidian-adapters";
import type { ClockPort, ConfirmPort, NotifierPort, VaultPort } from "./adapter/ports";
import { type CommandHost, registerCommands } from "./commands";
import type { Lang } from "./i18n/index";
import { I18nService } from "./i18n/runtime";
import { type ChapterTrailSettings, coerceSettings } from "./settings";
import { ChapterTrailSettingTab, type SettingsHooks, type SettingsTabHost } from "./settings-tab";

export default class ChapterTrailPlugin
  extends Plugin
  implements SettingsTabHost, CommandHost, SettingsHooks
{
  declare settings: ChapterTrailSettings;
  i18n!: I18nService;
  vaultPort!: VaultPort;
  clockPort!: ClockPort;
  notifierPort!: NotifierPort;
  confirmPort!: ConfirmPort;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.i18n = new I18nService(this.settings.language);

    this.vaultPort = new ObsidianVaultAdapter(this.app);
    this.clockPort = new SystemClockPort();
    this.notifierPort = new ObsidianNotifierPort();
    this.confirmPort = new ObsidianConfirmPort(this.app);

    const tab = new ChapterTrailSettingTab(this, this.i18n, this);
    tab.attachLangListener();
    this.addSettingTab(tab);

    registerCommands(this, this.i18n, this);
  }

  onunload(): void {
    (this.vaultPort as ObsidianVaultAdapter | undefined)?.dispose();
  }

  async loadSettings(): Promise<void> {
    this.settings = coerceSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /* ---------------- SettingsHooks ---------------- */

  async onIndexFileNameChange(name: string): Promise<string> {
    const effective = name.trim() === "" ? this.settings.indexFileName : name.trim();
    if (effective !== this.settings.indexFileName) {
      this.settings.indexFileName = effective;
      await this.saveSettings();
      this.notifierPort.notice(
        this.i18n.t("Index file name updated") +
          " — " +
          this.i18n.t(
            "New pages will use “{indexFile}” · affected domains marked “Index outdated” · nothing renamed",
            { indexFile: effective },
          ),
      );
    }
    return effective;
  }

  async onDateDisplayChange(mode: ChapterTrailSettings["dateDisplay"]): Promise<void> {
    this.settings.dateDisplay = mode;
    await this.saveSettings();
    this.notifierPort.notice(this.i18n.t("Date display: {mode}", { mode }));
  }

  async onInjectionToggle(next: boolean): Promise<boolean> {
    if (next) {
      // real enable flow (confirm + batch write) lands with the
      // NavWriter milestone; keep the hard gate closed until then
      this.notifierPort.notice(this.i18n.t("Not available yet"));
      return false;
    }
    this.settings.injectNavEnabled = false;
    await this.saveSettings();
    return false;
  }

  async countInjectedNotes(): Promise<number> {
    return 0;
  }

  async stripAllMarkers(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async onLanguageChange(lang: Lang): Promise<void> {
    this.settings.language = lang;
    await this.saveSettings();
    this.i18n.setLang(lang);
  }

  openRemoveAllWizard(): void {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  /* ---------------- CommandHost ---------------- */

  async startManagingFolder(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async stopManagingFolder(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async rebuildIndexCurrent(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async rebuildIndexAll(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async reindexOrderCurrent(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async rebuildInjectionCurrent(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async removeAllData(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async gotoPrev(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async gotoNext(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }

  async gotoIndex(): Promise<void> {
    this.notifierPort.notice(this.i18n.t("Not available yet"));
  }
}
