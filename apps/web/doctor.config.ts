export default {
  $schema: "https://react.doctor/schema/config.json",
  // lintはOxlintに集約し、CLIとGitHub Actionsではプロジェクト全体の解析を行う。
  lint: false,
  blocking: "none",
  supplyChain: {
    enabled: false,
  },
};
