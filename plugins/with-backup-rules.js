// Custom Expo config plugin: добавляет Android backup rules.
// Создаёт res/xml/data_extraction_rules.xml (Android 12+) и
// res/xml/full_backup_content.xml (legacy <12), регистрирует их в
// AndroidManifest через android:dataExtractionRules + android:fullBackupContent.
// По §6.6 спеки: SQLite + WAL/SHM/journal exclude, книги include.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DATA_EXTRACTION_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="fluera.db"/>
    <exclude domain="database" path="fluera.db-wal"/>
    <exclude domain="database" path="fluera.db-shm"/>
    <exclude domain="database" path="fluera.db-journal"/>
  </cloud-backup>
  <device-transfer>
    <include domain="file" path="Books/"/>
    <exclude domain="database" path="fluera.db"/>
    <exclude domain="database" path="fluera.db-wal"/>
    <exclude domain="database" path="fluera.db-shm"/>
    <exclude domain="database" path="fluera.db-journal"/>
  </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_CONTENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <include domain="file" path="Books/"/>
  <exclude domain="database" path="fluera.db"/>
  <exclude domain="database" path="fluera.db-wal"/>
  <exclude domain="database" path="fluera.db-shm"/>
  <exclude domain="database" path="fluera.db-journal"/>
</full-backup-content>
`;

function withBackupResources(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'data_extraction_rules.xml'),
        DATA_EXTRACTION_RULES_XML,
      );
      fs.writeFileSync(
        path.join(xmlDir, 'full_backup_content.xml'),
        FULL_BACKUP_CONTENT_XML,
      );
      return cfg;
    },
  ]);
}

function withManifestAttrs(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
      app.$['android:fullBackupContent'] = '@xml/full_backup_content';
      app.$['android:allowBackup'] = 'true';
    }
    return cfg;
  });
}

module.exports = function withBackupRules(config) {
  config = withBackupResources(config);
  config = withManifestAttrs(config);
  return config;
};
