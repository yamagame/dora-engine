#!/bin/bash
protoc -I=./proto --python_out=./asr/proto ./proto/*.proto
protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_opt=esModuleInterop=true --ts_proto_out=./src/voice proto/*.proto
