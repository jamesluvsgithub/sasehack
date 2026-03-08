module io (
    input  logic        clk,
    input  logic        rst_n,
    input  logic [13:0] player1_in,
    input  logic [13:0] player2_in,
	 
    output logic        player1_out, 
    output logic        player2_out,
    output logic        done,
	 output logic			clk_out,
	 
	 output logic [6 :0] ssg_p1l,
	 output logic [6 :0] ssg_p1r,
	 output logic [6 :0] ssg_p2l,
	 output logic [6 :0] ssg_p2r,
	 output logic [6 :0] ssg_i
);

    logic slow_clk;

    clk_divider #(
        .DIV_WIDTH(5)
    ) u_clk_div (
        .clk_in(clk),
        .rst_n(rst_n),
        .clk_out(slow_clk)
    );
	 

    logic [3:0] i;
	 
	 assign clk_out = slow_clk;

    always_ff @(posedge slow_clk or negedge rst_n) begin
        if (!rst_n) begin
            i <= 0;
            done <= 0;
        end else begin
            if (i == 13) begin
                i <= 0;
                done <= 1;
            end else begin
                i <= i + 1;
                done <= 0;
            end

            player1_out <= player1_in[i];
            player2_out <= player2_in[i];
				
        end
    end
	 
	 sevenseg u7seg_i (
        .input_val(i),
        .output_seg(ssg_i)
    );

endmodule