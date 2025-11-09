module.exports = function(api) {
  api.cache(true);

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], require("react-native-css-interop/babel")],

      plugins: [
        [
          require.resolve("babel-plugin-module-resolver"),
          {
            root: ["./"],
            alias: {
              "@": "./",
              "tailwind.config": "./tailwind.config.js"
            }
          }
        ],
        [
          require.resolve("@babel/plugin-transform-react-jsx"),
          {
            runtime: "automatic",
            importSource: "react-native-css-interop"
          }
        ],
        require.resolve("react-native-worklets/plugin")
      ]
  };
};
