import argparse
import json
import matplotlib.pyplot as plt


def generate_line_graph(data, key, input_filename, ylabel, title, show_integer_y=False):
    x = [entry[1] for entry in data[key]]
    y = [entry[0] for entry in data[key]]
    
    # Set the figure size to fit one column and remove whitespace
    plt.figure(figsize=(5, 4), tight_layout=True)  # Adjust the width and height as needed
    
    plt.plot(x, y, marker='o', color='b', linewidth=1, markersize=2, label=key)
    plt.xlabel('Time Stamp (seconds)', fontsize=12, weight='bold')
    plt.ylabel(ylabel, fontsize=12, weight='bold')
    plt.title(title, fontsize=12, weight='bold')
    plt.grid(True, linestyle='--', alpha=0.7)
    
    plt.xticks(fontsize=12)
    plt.yticks(fontsize=12)
    
    if show_integer_y:
        print(input_filename)
        plt.yticks(range(int(min(y)), int(max(y)) + 1))
    
    output_filename = f"{input_filename.replace('.json', '')}_{key}.pdf"
    plt.savefig(output_filename, format='pdf')
    
    plt.close()

def main():
    parser = argparse.ArgumentParser(description='Generate line graphs from JSON data')
    parser.add_argument('input_file', type=str, help='Path to the input JSON file')
    args = parser.parse_args()
    
    with open(args.input_file, 'r') as file:
        json_data = json.load(file)
    
    input_filename = args.input_file.split('/')[-1].split('.')[0]


    
    ylabels = {
    'processingTimeRecords': "Processing Time(s)",
    'creditBalanceRecords': "CPU Credits",
    'approximateNumberOfMessagesRecords': "Number of Requests",
    'clusterSizeRecords': "Cluster Size"
    }

    titles = {
        'execution_data_150': 'low-demand scenario (150 Batches)',
        'execution_data_300': 'medium-demand scenario (300 Batches)',
        'execution_data_600': 'high-demand scenario (600 Batches)'
    }
    for key in json_data:
        if isinstance(json_data[key], list):
            show_integer_y = False
            if key == "clusterSizeRecords":
                show_integer_y = True
            generate_line_graph(json_data, key, input_filename, ylabels[key], titles[input_filename], show_integer_y)

if __name__ == '__main__':
    main()
