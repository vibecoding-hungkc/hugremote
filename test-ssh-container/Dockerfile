FROM ubuntu:22.04

# Avoid prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install OpenSSH server and dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    bash \
    sudo \
    curl \
    git \
    python3 \
    htop \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH daemon
RUN mkdir /var/run/sshd && \
    echo 'root:root123' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Create user devops with sudo access
RUN useradd -rm -d /home/devops -s /bin/bash -g root -G sudo -u 1000 devops && \
    echo 'devops:devops123' | chpasswd && \
    echo 'devops ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Setup authorized keys for devops user
RUN mkdir -p /home/devops/.ssh && \
    chmod 700 /home/devops/.ssh && \
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHoH2t6lCDbSXZI5smYzmYrtOdn3Wri/5W76a38OqCVb hugcode-test" > /home/devops/.ssh/authorized_keys && \
    chmod 600 /home/devops/.ssh/authorized_keys && \
    chown -R devops:root /home/devops/.ssh

# Create sample workspace files for devops user
RUN mkdir -p /home/devops/workspace && \
    echo "# Demo Microservice in Remote Container" > /home/devops/workspace/README.md && \
    echo "This is a remote SSH container workspace tested by HugCode Mobile IDE." >> /home/devops/workspace/README.md && \
    echo "print('Hello from remote SSH container!')" > /home/devops/workspace/app.py && \
    echo '{"env": "remote-docker", "version": "1.0.0"}' > /home/devops/workspace/config.json && \
    chown -R devops:root /home/devops/workspace

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
