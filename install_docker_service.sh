#!/usr/bin/env bash
docker build . -t minigate
docker run --name=minigate --restart=always -d -p 8000:8000 minigate
