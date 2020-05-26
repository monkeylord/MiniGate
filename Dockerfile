# node@latest on 2020-05-19
FROM node@sha256:0fb622c982d15db12581b4e3ffc8af93e1c3198db477f431ced2431331d3c236

# setup commands
WORKDIR /usr/src/minigate
COPY . .
RUN npm install

# public port
EXPOSE 8000

# execution
CMD ["./update_and_launch.sh"]
