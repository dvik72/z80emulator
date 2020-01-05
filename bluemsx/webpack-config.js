module.exports = {
  devtool: 'source-map',
  entry: "./index.js",
  mode: "development",
  output: {
    filename: "./app-bundle.js"
  },
  resolve: {
    extensions: ['.ts', '.js', '.css']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'ts-loader'
        }
      },
      {
        test: /\.css$/,
        use: [
          'to-string-loader',
          'css-loader'
        ],
      },
      {
        test: /\.(png|jp(e*)g|svg)$/,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 8000,
            name: '[hash]-[name].[ext]',
            outputPath: 'img',
            publicPath: 'dist/img',
            esModule: false
          }
        }]
      }
    ]
  }
}
