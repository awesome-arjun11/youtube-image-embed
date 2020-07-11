import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import path from 'path';
import { uglify } from "rollup-plugin-uglify";


export default {
  input: 'src/index.js',
  output:[
    {
      file: 'dist/yt_image_embed.js',
      format: 'cjs'
    }
  ],
  plugins:  [
    resolve({browser: true, preferBuiltins: true }), 
    commonjs (
      {
        include: /node_modules/,
        transformMixedEsModules: false
      }
    ),
    babel({ babelHelpers: 'runtime', configFile: path.resolve(__dirname, '.babelrc') }),
    uglify()
  ]
};