import terser from "@rollup/plugin-terser"

const version = "1.0.1"

export default {
  input: "src/index.js",
  output: {
    file: "dist/chat-widget.min.js",
    format: "iife",
    name: "ChatWidget",
    banner: `/*!
 * LuisByt Chat Widget v${version}
 * https://github.com/luis-byt/chat-widget
 * © 2025 LuisByt
 * MIT License
 */`
  },
  plugins: [
    terser()
  ]
}
