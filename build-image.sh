#!/bin/bash

IMAGE=kristobalus/guest-keeper:1.0.1
echo "building image $IMAGE..."

docker build -t "$IMAGE" -f ./Dockerfile \
		--progress=plain \
		--label "build-tag=build-artifact" \
		--platform=linux/amd64  . || { echo "failed to build docker image"; exit 1; }

echo "pushing image $IMAGE to registry.."
docker push "$IMAGE"
docker image prune -f --filter label=build-tag=build-artifact
