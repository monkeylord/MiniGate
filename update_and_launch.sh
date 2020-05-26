#!/usr/bin/env bash

# TODO: check commit signatures
git pull
npm install
exec node index.js
