import terser from "@rollup/plugin-terser"

const version = "1.0.13"
const banner = `/*!
 * LuisByt Chat Widget v${version}
 * https://github.com/luis-byt/chat-widget
 * © 2025 Byt
 * MIT License
 */`

export default [
  // 🧩 Build NORMAL (no minificado)
  {
    input: "src/index.js",
    output: {
      file: "dist/chat-widget.js",
      format: "iife",
      name: "ChatWidget",
      banner
    }
  },

  // 🚀 Build MINIFICADO (producción)
  {
    input: "src/index.js",
    output: {
      file: "dist/chat-widget.min.js",
      format: "iife",
      name: "ChatWidget",
      banner
    },
    plugins: [
      terser()
    ]
  }
]
