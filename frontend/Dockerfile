FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN mkdir -p node_modules/.vite-temp \
	&& chmod -R 0777 node_modules/.vite-temp

EXPOSE 5173
ENTRYPOINT []
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
