#!/bin/bash

# 파라미터가 없으면 종료
if [ "$#" -lt 1 ]; then
    echo "$# is Illegal number of parameters."
    echo "Usage: $0 [chaincode_name]"
    exit 1
fi

# 체인코드 디렉토리 확인
CHAINCODE_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/$1/javascript"
if [ ! -d "$CHAINCODE_PATH" ]; then
    echo "Error: Chaincode directory $CHAINCODE_PATH does not exist."
    exit 1
fi

# 작업 디렉토리 설정
cd /opt/gopath/src/github.com/hyperledger/fabric/peer

# 체인코드 패키지화
echo "체인코드 패키지화"
peer lifecycle chaincode package "$1.tar.gz" \
    --path "./chaincode/$1/javascript" \
    --lang node \
    --label "$1"

# Org1 체인코드 설치 (이미 설치된 경우 생략 가능)
echo "Org1 peer0 체인코드 설치"
peer lifecycle chaincode install "$1.tar.gz"

# 체인코드 패키지 ID 확인
echo "패키지 ID 확인"
peer lifecycle chaincode queryinstalled >&log.txt
export PACKAGE_ID=$(sed -n "/$1:/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
if [ -z "$PACKAGE_ID" ]; then
    echo "Error: Failed to retrieve PACKAGE_ID for $1"
    cat log.txt
    exit 1
fi
echo "PACKAGE_ID=$PACKAGE_ID"

# 체인코드 승인
echo "체인코드 승인"
peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    --channelID channel1 \
    --name "$1" \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1

# 체인코드 커밋
echo "체인코드 커밋"
peer lifecycle chaincode commit \
    -o orderer.example.com:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    --channelID channel1 \
    --name "$1" \
    --peerAddresses peer0.org1.example.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    --version 1.0 \
    --sequence 1

# 커밋 상태 확인
echo "체인코드 커밋 상태 확인"
peer lifecycle chaincode querycommitted --channelID channel1 --name "$1"

# 체인코드 초기화 테스트
echo "체인코드 초기화 테스트"
peer chaincode invoke \
    -o orderer.example.com:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    -C channel1 \
    -n "$1" \
    --peerAddresses peer0.org1.example.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    -c '{"function":"initLedger","Args":[]}'