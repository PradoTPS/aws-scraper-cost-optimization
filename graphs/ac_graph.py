import matplotlib.pyplot as plt

allocation_cycles = ["TSLA/2", "TSLA/4", "TSLA/8"]
average_time = [4800, 2300, 2204]
average_cost = [0.15, 0.06, 0.08]

plt.figure(figsize=(6, 4))  # Adjust the figure size to fit one column

fig, ax1 = plt.subplots()

ax1.set_xlabel("Allocation Cycle", fontsize=16)  # Increase font size here
ax1.set_ylabel("Monetary Cost (USD)", color="tab:blue", fontsize=16)  # Increase font size and set color
bars = ax1.bar(allocation_cycles, average_cost, color="tab:blue", label="Monetary Cost")

ax2 = ax1.twinx()
ax2.set_ylabel("Time (s)", color="tab:red", fontsize=16)  # Increase font size and set color
line = ax2.plot(allocation_cycles, average_time, '--', color="tab:red", marker="o", label="Execution Time")

ax1.tick_params(axis="y", labelcolor="tab:blue", labelsize=12)
ax2.tick_params(axis="y", labelcolor="tab:red", labelsize=12)

lines, labels = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax2.legend(lines + lines2, labels + labels2, loc="upper right", bbox_to_anchor=(1.0, 0.9),  fontsize=14)

plt.tight_layout()
plt.savefig("ac_test.pdf")
