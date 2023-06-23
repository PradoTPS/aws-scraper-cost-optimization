<!--
title: 'Web Scraping na Nuvem AWS: Uma Abordagem com Máquinas Virtuais Burstable'
description: 'This work describes a Web Scraping framework based on burstable virtual machines of AWS to reduce financial costs while meeting a given deadline. The framework defines a mixed cluster, with  fixed and temporary burstable virtual machines. That cluster can be elastically increased or decreased by varying the  instances of the  set of  temporary burstable VMs, to meet the  scraping requests SLA and reduce the financial cost.
    
The proposed framework was evaluated in the AWS cloud environment and compared to an entirely on-demand instances cluster (regular approach) and also to a FaaS-based approach. It was able of reducing the financial cost by up to 96\% when compared to the FaaS approach, and by up to 95.59\%  when compared to the regular approach in the best cases. In addition, in all other cases, it achieved at least 93,26\% of cost savings, showing that burstable instances can be an excellent tool for this problem.'
-->

# Overview

# Web Scraping na Nuvem AWS: Uma Abordagem com Máquinas Virtuais Burstable

This work describes a Web Scraping framework based on burstable virtual machines of AWS to reduce financial costs while meeting a given deadline. The framework defines a mixed cluster, with  fixed and temporary burstable virtual machines. That cluster can be elastically increased or decreased by varying the  instances of the  set of  temporary burstable VMs, to meet the  scraping requests SLA and reduce the financial cost.
    
The proposed framework was evaluated in the AWS cloud environment and compared to an entirely on-demand instances cluster (regular approach) and also to a FaaS-based approach. It was able of reducing the financial cost by up to 96\% when compared to the FaaS approach, and by up to 95.59\%  when compared to the regular approach in the best cases. In addition, in all other cases, it achieved at least 93,26\% of cost savings, showing that burstable instances can be an excellent tool for this problem.


## Getting Started

The codes were developed on a Debian-like system (Ubuntu 20.04 LTS). All instructions reported here are based on this
system. Number versions are provided as an indication of the versions that were tested and used in this project.

### Getting the Dependencies

- [nvm, node and npm](https://www.javatpoint.com/install-nvm-ubuntu)
- [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [aws sdk]
- [serverless framework](https://www.npmjs.com/package/serverless#quick-start)

### Installing the project