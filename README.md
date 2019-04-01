# MiniGate
A light weight metanet gateway for bitcoin.

### Install

#### Install Nodejs

Download Nodejs [here](https://nodejs.org/).

#### Install MiniGate

1. Open a command line.
2. `npm install -g minigate`

### Usage

Use command

~~~shell
minigate
~~~

You will see

>MiniGate Listening on 8000 ...
>  Version: 0.0.1
>  Electrum Server: electrumx.bitcoinsv.io:50002

Now you can browse metanet B protocol resources at http://127.0.0.1:8000

### Advanced

You can specify which ElectrumX server minigate should connect to, by `-e` option.

like `minigate -e sv.satoshi.io`:50002

To find ElectrumX server, just open your electrum wallet, `Tools` -> `Network` -> `Server`, then you can see a list of server.

You can also specify which local port minigate should listen to, by `-p` option.

like `minigate -p 8080`