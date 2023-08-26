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

## Running

### Configure the orchestrator instance

First you need to configure the main cluster instance to be able to run the project, we need to do that because at the time of creation of the instance the image (AMI) with it's dependencies is still being created via cloudformation.

For this you need to [connect on the main instance using SSH](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstancesLinux.html) and perform the same steps **Dependencies to run the project**, **Credentials**, **Cloning and Deploying** (without need of deploy) of the topic **Setting up**.

### Run the orchestrate instances script on main instance

After configuring the main machine, still connected on it with SSH, you need to run the script that will start the orchestration of instances, creating and deleting new one based on queue volume.

First you must access the JSON file that will define the parameters for the script execution. For that access the path _tests/events/orchestrateInstances.json_ on project and edit the attributes based on your needs.

* @param {Number} sla - Integer size indicating the SLA (Service Level Agreement) time in milliseconds
* @param {Number} parallelProcessingCapacity - Number indicating how many messages one instance can handle in parallel
* @param {Number} maximumClusterSize - Maximum number of instances on cluster
* @param {String} [instanceType ='t2.small'] - Type of instances that orchestrator will create
* @param {String} resultsPath - Path where execution results will be saved
* @param {String} [privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem'] - String indicating path to EC2 privateKey

After defining your attributes you can run the script using the serverless command: `sls invoke local -f OrchestrateInstances -p tests/events/orchestrateInstances.json`.

All tests results will be saved on this machine as JSON and PNG files.

### Run the consume queue script on main instance

Now we can start consuming messages from the queue with the main instance (on instances created by the orchestrate instances script there is no need to do that because the script itself will start this process on new machines).

First you must access the JSON file that will define the parameters for the script execution. For that access the path _tests/events/consumeQueue.json_ on project and edit the attributes based on your needs.

* @param {Number} readBatchSize - Integer size indicating the number of messages to be read by batch

After defining your attributes you can run the script using the serverless command: `sls invoke local -f ConsumeQueue -p tests/events/consumeQueue.json`.

### Run the populate queue script on your machine

At this point we have the main instance running the orchestrate instances script (that will evaluate the system needs for creating or deleting instances) and the consume queue script (that will fetch messages from queue and proccess then, dealing with the scrapping request).

Now we just need to start populating the queue with new requests, this can be done at your own local machine.

First you must access the JSON file that will define the parameters for the script execution. For that access the path _tests/events/populateQueue.json_ on project and edit the attributes based on your needs.

* @param {Number} batchSize - Integer size indicating the number of messages sent by batch
* @param {Number} numberOfBatches - Integer size indicating the number of batches to be sent
* @param {Number} delay - Integer time in milliseconds indicating the delay between batches

To edit the format of requests that will be sent to queue you can access the file _src/functions/scripts/populateQueue.js_ and edit the variable _defaultMessage_ defined at main function.

After defining your attributes you can run the script using the serverless command: `sls invoke local -f PopulateQueue -p tests/events/populateQueue.json`.

That will start to put requests on the queue and you should be able to see the messages starting to be consumed on the logs of your main instance.
