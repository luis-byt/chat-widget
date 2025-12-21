import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default {
  input: "src/index.js",
  output: {
    file: "dist/chat-widget.umd.js",
    format: "umd",
    name: "ChatWidget",
  },
  plugins: [
    resolve(),
    commonjs()
  ]
}

