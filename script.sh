#!/bin/bash
export NODE_OPTIONS=--max_old_space_size=8192
while :
do
	ts-node index.ts
done