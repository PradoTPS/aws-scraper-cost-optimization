<!--
title: 'Web Scraping na Nuvem AWS: Uma Abordagem com Máquinas Virtuais Burstable'
description: 'This work describes a Web Scraping framework based on burstable virtual machines of AWS to reduce financial costs while meeting a given deadline. The framework defines a mixed cluster, with  fixed and temporary burstable virtual machines. That cluster can be elastically increased or decreased by varying the  instances of the  set of  temporary burstable VMs, to meet the  scraping requests SLA and reduce the financial cost.
    
The proposed framework was evaluated in the AWS cloud environment and compared to an entirely on-demand instances cluster (regular approach) and also to a FaaS-based approach. It was able of reducing the financial cost by up to 96\% when compared to the FaaS approach, and by up to 95.59\%  when compared to the regular approach in the best cases. In addition, in all other cases, it achieved at least 93,26\% of cost savings, showing that burstable instances can be an excellent tool for this problem.'
-->

# Overview

# Web Scraping in the AWS: An Approach with Burstable Virtual Machines

This work describes a Web Scraping framework based on burstable virtual machines of AWS to reduce financial costs while meeting a given deadline. The framework defines a mixed cluster, with  fixed and temporary burstable virtual machines. That cluster can be elastically increased or decreased by varying the  instances of the  set of  temporary burstable VMs, to meet the  scraping requests SLA and reduce the financial cost.
    
The proposed framework was evaluated in the AWS cloud environment and compared to an entirely on-demand instances cluster (regular approach) and also to a FaaS-based approach. It was able of reducing the financial cost by up to 96\% when compared to the FaaS approach, and by up to 95.59\%  when compared to the regular approach in the best cases. In addition, in all other cases, it achieved at least 93,26\% of cost savings, showing that burstable instances can be an excellent tool for this problem.


## Setting up

### Dependencies to run the project
To run and test this project, you will need:
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Node 14 or later and npm](https://heynode.com/tutorial/install-nodejs-locally-nvm/)
- Serverless v2 (`npm i serverless@2 -g`)

### Credentials
Once you have everything installed, you will need to set your aws credentials.
To do this, use the command `aws configure --profile aws-scraper` with your IAM credentials.
Note that the profile need to be setted as "aws-scraper".

### Setting up predefined AWS resources in your account
This project creates all necessary resources through AWS CloudFormation except:
- The **EC2 Key Pair** to connect with the instances during the tests
- The **Systems Manager Param** that stores de AWS Access Key Id to configure the project inside the instances
- The **Systems Manager Param** that stores de AWS Secret Access Key to configure the project inside the instances

To create these resources, you will need login to your AWS account at the [AWS Console](https://console.aws.amazon.com/) and access the following pages:
- [EC2 Home > Key Pairs](https://us-east-1.console.aws.amazon.com/ec2/home#KeyPairs:) and click on the "Create key pair" button. You will need to create your key pair with **"scraper-instance-key-pair"** as name (without quotes).
- [Systems Manager > Parameter Store](https://us-east-1.console.aws.amazon.com/systems-manager/parameters/) and click on the "Create parameter" button. You will need to create your parameter with the name **ec2-aws-access-key-id**. This parameter also needs to be String type. In the field Data type (text), paste the same AWS Access Key Id you used to set up your local environment (see credentials).
- [Systems Manager > Parameter Store](https://us-east-1.console.aws.amazon.com/systems-manager/parameters/) and click on the "Create parameter" button. You will need to create your parameter with the name **ec2-aws-secret-access-key**. This parameter also needs to be String type. In the field Data type (text), paste the same AWS Secret Access Key you used to set up your local environment.

### Cloning and Deploying
With all those steps done, now you can prepare to clone and deploy this project to your AWS account.
To accomplish that, you will need to run some commands:
- `git clone https://github.com/PradoTPS/aws-scraper-cost-optimization.git`
- `cd ./aws-scraper-cost-optimization`
- `npm i`
- `sls deploy`

The described commands clone this project, navigate to the project folder, install dependencies and start the deploy.
