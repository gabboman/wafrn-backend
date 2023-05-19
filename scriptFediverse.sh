#!/bin/bash
export NODE_OPTIONS=--max_old_space_size=4096
while :
do
	ts-node indexFederation.ts
done