FROM node:18.17.0-buster

RUN mkdir -p /opt

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "/opt/"]
WORKDIR /opt
RUN npm install

COPY ./src /opt/src
ENTRYPOINT ["npm", "run", "start"]
