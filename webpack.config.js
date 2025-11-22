const path = require('path');

module.exports = {
    mode: "development", // debug only, disable ltr
    entry: "./src/main.ts",
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: "main.js",
        path: path.resolve(__dirname, "dist") 
    }
}