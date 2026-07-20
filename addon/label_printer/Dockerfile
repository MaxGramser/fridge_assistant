ARG BUILD_FROM
FROM $BUILD_FROM

# CUPS + build tools for the DYMO driver, plus a tiny Python print service.
RUN apk add --no-cache \
    cups \
    cups-libs \
    cups-filters \
    cups-dev \
    build-base \
    boost-dev \
    autoconf \
    automake \
    libtool \
    git \
    eudev-dev \
    usbutils \
    libusb \
    libusb-compat \
    unzip \
    ghostscript \
    python3 \
    py3-flask \
    py3-pillow \
    ttf-dejavu

# CUPS config (no auth inside the container network).
COPY cupsd.conf /etc/cups/cupsd.conf
RUN chmod 644 /etc/cups/cupsd.conf

# Build & install the DYMO CUPS drivers (bundle includes the LabelWriter 550 PPD).
# Two patches to the LW5xx language monitor so it actually prints on this LW550:
#  1) CheckLabel: main-bay status 10 is treated as "counterfeit media"
#     (com.dymo.counterfeit-error) and loops forever. Many genuine/compatible
#     99014 rolls trip this, so we drop that check. (States 1,2,3,5,9 kept.)
#  2) CheckLock: waits for print-engine status 0 (idle) before printing, but
#     this LW550's firmware persistently reports status 2, so the job never
#     starts. We gate only on "no active job id" (jobID == 0) instead.
COPY dymo_drivers.zip /tmp/dymo_drivers.zip
RUN cd /tmp \
    && unzip -q dymo_drivers.zip \
    && cd dymo_drivers \
    && LM=src_v2/lw/LabelWriterLanguageMonitorV2.cpp \
    && sed -i 's/ || (mbStatus == 10)//' "$LM" \
    && sed -i 's/if(peStatus == 0 && jobID == 0)/if(jobID == 0)/' "$LM" \
    && grep -q "mbStatus == 9))" "$LM" \
    && grep -q "if(jobID == 0)" "$LM" \
    && ./build.sh \
    && make install \
    && cd / \
    && rm -rf /tmp/dymo_drivers /tmp/dymo_drivers.zip

COPY run.sh /run.sh
COPY server.py /server.py
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
