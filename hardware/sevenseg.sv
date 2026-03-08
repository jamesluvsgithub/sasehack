module sevenseg (
    input  logic [3:0] input_val,   // 4-bit input
    output logic [6:0] output_seg   // 7-segment output (a-g)
);

    always_comb begin
        case (input_val)
            4'b0000: output_seg = 7'b1000000; // 0
            4'b0001: output_seg = 7'b1111001; // 1
            4'b0010: output_seg = 7'b0100100; // 2
            4'b0011: output_seg = 7'b0110000; // 3
            4'b0100: output_seg = 7'b0011001; // 4
            4'b0101: output_seg = 7'b0010010; // 5
            4'b0110: output_seg = 7'b0000010; // 6
            4'b0111: output_seg = 7'b1111000; // 7
            4'b1000: output_seg = 7'b0000000; // 8
            4'b1001: output_seg = 7'b0010000; // 9
            4'b1010: output_seg = 7'b0001000; // A
            4'b1011: output_seg = 7'b0000011; // B
            4'b1100: output_seg = 7'b1000110; // C
            4'b1101: output_seg = 7'b0100001; // D
            4'b1110: output_seg = 7'b0000110; // E
            4'b1111: output_seg = 7'b0001110; // F
            default: output_seg = 7'b1111111; // all off
        endcase
    end

endmodule