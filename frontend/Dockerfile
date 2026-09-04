FROM cgr.dev/chainguard/node:latest-dev

USER root

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /tmp/.vite \
	&& chmod -R 0777 /tmp/.vite

EXPOSE 5173
ENTRYPOINT []
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
