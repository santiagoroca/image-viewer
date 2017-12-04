var webpack = require('webpack');
var path = require('path');

module.exports = {
    entry: {
        lib: ['./app/index.js'],
    },

    output: {
        path: path.resolve(__dirname, 'build/'),
        filename: 'image-viewer.min.js',
        library: 'ImageViewer',
        publicPath: 'http://localhost:8181/'
    },

    devServer: {
      contentBase: './',
      host: '0.0.0.0',
      port: 8181,
      allowedHosts: [
        'local.youbim.com',
        'localhost',
        '192.168.0.169'
      ]
    },

    module: {
        loaders: [
            {
                test: /\.js$/,

                use: [
                    {
                        loader: 'babel-loader'
                    }
                ],

                exclude: '/node_modules/'
            }
        ]
    },

    plugins: [
        new webpack.HotModuleReplacementPlugin()
    ]
};