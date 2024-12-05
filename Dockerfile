FROM node:lts-alpine

COPY entrypoint.sh /usr/bin/

RUN \
chmod 755 /usr/bin/entrypoint.sh \
&& mkdir /app \
&& chown -R node:node /app

WORKDIR /app
USER node

COPY --chown=node . .
RUN yarn install --frozen-lockfile

ENTRYPOINT ["entrypoint.sh"]
CMD ["yarn", "docker"]
